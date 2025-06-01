import React, { useState, useCallback, ChangeEvent, useRef, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { StorageService, ImageService } from '../services/supabaseService';
import { UploadedImageFile } from '../types';

interface FileUploadProps {
  onFilesSelected: (files: UploadedImageFile[]) => void;
  maxFiles?: number;
  isLoading: boolean;
  analysisPointId?: string; // Add analysis point ID for storage organization
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  onFilesSelected, 
  maxFiles = 10, 
  isLoading,
  analysisPointId 
}) => {
  const { user: clerkUser } = useUser();
  const [selectedFiles, setSelectedFiles] = useState<UploadedImageFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [pendingSupabaseUploads, setPendingSupabaseUploads] = useState<UploadedImageFile[]>([]);
  const nextFileId = useRef(0); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Supabase uploads when analysisPointId becomes available
  useEffect(() => {
    if (!clerkUser || !analysisPointId || pendingSupabaseUploads.length === 0) return;

    const processPendingUploads = async () => {
      console.log(`Processing ${pendingSupabaseUploads.length} pending Supabase uploads with analysisPointId: ${analysisPointId}`);
      
      for (const fileData of pendingSupabaseUploads) {
        try {
          setUploadingFiles(prev => new Set(prev).add(fileData.id));
          
          // Recreate File object from the stored data
          const response = await fetch(fileData.previewUrl);
          const blob = await response.blob();
          const file = new File([blob], fileData.name, { type: fileData.type });
          
          const { storagePath, publicUrl } = await StorageService.uploadImage(
            file,
            clerkUser.id,
            analysisPointId
          );
          
          // Save image metadata to database
          await ImageService.saveImageMetadata(
            analysisPointId,
            fileData.name,
            file.size,
            fileData.type,
            storagePath
          );
          
          // Update the file with storage info
          setSelectedFiles(prevFiles => 
            prevFiles.map(f => 
              f.id === fileData.id 
                ? { ...f, storageUrl: publicUrl, storagePath: storagePath }
                : f
            )
          );
          
          console.log(`Supabase upload successful for: ${fileData.name}`);
          
        } catch (error) {
          console.error(`Supabase upload failed for ${fileData.name}:`, error);
        } finally {
          setUploadingFiles(prev => {
            const newSet = new Set(prev);
            newSet.delete(fileData.id);
            return newSet;
          });
        }
      }
      
      // Clear pending uploads
      setPendingSupabaseUploads([]);
      
      // Notify parent with updated files
      setSelectedFiles(currentFiles => {
        onFilesSelected(currentFiles);
        return currentFiles;
      });
    };

    processPendingUploads();
  }, [analysisPointId, clerkUser, pendingSupabaseUploads, onFilesSelected]);

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const currentInputFiles = event.target.files ? Array.from(event.target.files) : [];
    
    const filesToProcess = currentInputFiles; 
    const newProcessedFiles: UploadedImageFile[] = [];
    let localError: string | null = null;

    if (filesToProcess.length > maxFiles) {
        localError = `一度に選択できるファイルは${maxFiles}個までです。最初の${maxFiles}個のファイルのみが選択されました。`;
        filesToProcess.splice(maxFiles); 
    }

    for (const file of filesToProcess) {
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            localError = (localError ? localError + "\n" : "") + `${file.name} は画像または動画ファイルではありません。スキップされました。`;
            continue;
        }
        
        try {
            const fileId = `file-${nextFileId.current++}`;
            setUploadingFiles(prev => new Set(prev).add(fileId));
            
            // Convert to base64 for Gemini API (existing functionality)
            const base64 = await convertFileToBase64(file);
            const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
            
            // Create initial file object
            const uploadedFile: UploadedImageFile = {
                id: fileId,
                name: file.name,
                type: file.type,
                base64: base64.split(',')[1],
                previewUrl,
                storageUrl: '', // Will be updated after Supabase upload
                storagePath: '', // Will be updated after Supabase upload
            };
            
            // Upload to Supabase Storage if user is authenticated and analysisPointId is available
            if (clerkUser && analysisPointId) {
                console.log(`Starting upload for file: ${file.name}, analysisPointId: ${analysisPointId}`);
                try {
                    const { storagePath, publicUrl } = await StorageService.uploadImage(
                        file,
                        clerkUser.id,
                        analysisPointId
                    );
                    uploadedFile.storageUrl = publicUrl;
                    uploadedFile.storagePath = storagePath;
                    console.log(`File uploaded to storage: ${storagePath}`);
                    
                    // Save image metadata to database
                    const savedImageMetadata = await ImageService.saveImageMetadata(
                        analysisPointId,
                        file.name,
                        file.size,
                        file.type,
                        storagePath
                    );
                    console.log(`Image metadata saved:`, savedImageMetadata);
                } catch (storageError) {
                    console.error('Failed to upload to Supabase storage:', storageError);
                    // Continue with local file handling even if storage upload fails
                }
            } else if (clerkUser && !analysisPointId) {
                console.log(`Deferring Supabase upload for file: ${file.name} - waiting for analysisPointId`);
                // Add to pending uploads to be processed when analysisPointId becomes available
                setPendingSupabaseUploads(prev => [...prev, uploadedFile]);
            } else {
                console.warn(`Skipping Supabase upload - clerkUser: ${!!clerkUser}, analysisPointId: ${analysisPointId}`);
            }
            
            newProcessedFiles.push(uploadedFile);
            setUploadingFiles(prev => {
                const newSet = new Set(prev);
                newSet.delete(fileId);
                return newSet;
            });
            
        } catch (e) {
            localError = (localError ? localError + "\n" : "") + `${file.name} の処理中にエラーが発生しました。`;
            setUploadingFiles(prev => {
                const newSet = new Set(prev);
                newSet.delete(`file-${nextFileId.current - 1}`);
                return newSet;
            });
        }
    }
    
    setSelectedFiles(newProcessedFiles); 
    onFilesSelected(newProcessedFiles);   

    if (localError) setError(localError);
  }, [maxFiles, onFilesSelected, clerkUser, analysisPointId]);

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const removeFile = async (fileIdToRemove: string) => {
    const fileToRemove = selectedFiles.find(f => f.id === fileIdToRemove);
    
    // Delete from Supabase storage if it was uploaded
    if (fileToRemove?.storagePath && clerkUser) {
        try {
            await StorageService.deleteImage(fileToRemove.storagePath);
        } catch (error) {
            console.warn('Failed to delete file from storage:', error);
        }
    }
    
    const updatedFiles = selectedFiles.filter(file => file.id !== fileIdToRemove);
    setSelectedFiles(updatedFiles);
    
    // Also remove from pending uploads if it exists there
    setPendingSupabaseUploads(prev => prev.filter(file => file.id !== fileIdToRemove));
    
    onFilesSelected(updatedFiles); 
    
    // Clear input value so user can re-add the same file if they want
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }

    if (error && updatedFiles.length <= maxFiles) { 
      const errors = error.split('\n');
      const fileSpecificErrorPattern = /は画像または動画ファイルではありません|の処理中にエラーが発生しました/;
      const generalMaxFileError = `一度にアップロードできるファイルは${maxFiles}個までです`;
      
      if (error.includes(generalMaxFileError) && updatedFiles.length <= maxFiles) {
         setError(null);
      } else if (!errors.some(e => fileSpecificErrorPattern.test(e) && selectedFiles.find(f => e.includes(f.name)))) {
         if (updatedFiles.length <= maxFiles) setError(null);
      }
    }
  };
  
  const currentFileCount = selectedFiles.length;
  const fileInputLabel = `顔の画像/動画を選択 (${currentFileCount}/${maxFiles} ファイル選択済)`;
  const isAnyFileUploading = uploadingFiles.size > 0;

  return (
    <div className="w-full py-4">
      <label htmlFor={`file-upload-input-${React.useId()}`} className="block text-sm font-medium text-gray-700 mb-1">
        {fileInputLabel}
      </label>
      <input
        id={`file-upload-input-${React.useId()}`}
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        onChange={handleFileChange}
        disabled={isLoading || isAnyFileUploading}
        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
        aria-describedby={error ? `file-upload-error-${React.useId()}` : undefined}
      />
      
      {isAnyFileUploading && (
        <div className="mt-2 flex items-center gap-2 text-sm text-blue-600">
          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          ファイルをアップロード中...
        </div>
      )}
      
      {error && <p id={`file-upload-error-${React.useId()}`} className="mt-2 text-sm text-red-600 whitespace-pre-line" role="alert">{error}</p>}
      
      {selectedFiles.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-semibold text-gray-500 mb-1">選択中のファイル:</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1 border rounded-md">
            {selectedFiles.map((file) => (
              <div key={file.id} className="relative group border rounded-md p-1 shadow-sm bg-gray-50">
                {file.type.startsWith('image/') ? (
                  <img src={file.previewUrl} alt={file.name} className="w-full h-20 object-cover rounded" />
                ) : (
                  <div className="w-full h-20 bg-gray-200 flex items-center justify-center rounded" aria-label="Video file icon">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-500" viewBox="0 0 20 20" fill="currentColor" focusable="false" aria-hidden="true">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm3 2h6v4H7V5zm0 5h6v2H7v-2z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1 truncate" title={file.name}>{file.name}</p>
                
                {/* Show storage status indicator */}
                {file.storageUrl && (
                  <div className="absolute top-0.5 left-0.5 bg-green-500 text-white rounded-full p-0 w-4 h-4 flex items-center justify-center text-xs">
                    ✓
                  </div>
                )}
                
                {/* Show pending upload indicator */}
                {!file.storageUrl && pendingSupabaseUploads.some(p => p.id === file.id) && (
                  <div className="absolute top-0.5 left-0.5 bg-yellow-500 text-white rounded-full p-0 w-4 h-4 flex items-center justify-center text-xs">
                    ⏳
                  </div>
                )}
                
                {uploadingFiles.has(file.id) ? (
                  <div className="absolute top-0.5 right-0.5 bg-blue-500 text-white rounded-full p-0 w-4 h-4 flex items-center justify-center text-xs">
                    <div className="animate-spin h-2 w-2 border border-white border-t-transparent rounded-full"></div>
                  </div>
                ) : !isLoading && (
                  <button
                    onClick={() => removeFile(file.id)}
                    className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0 w-4 h-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                    title={`Remove ${file.name}`}
                    aria-label={`Remove ${file.name}`}
                  >
                    X
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;

