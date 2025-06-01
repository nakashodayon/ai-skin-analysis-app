
import React, { useState, useCallback, ChangeEvent, useRef, useEffect } from 'react';
import { UploadedImageFile } from '../types';

interface FileUploadProps {
  onFilesSelected: (files: UploadedImageFile[]) => void;
  maxFiles?: number;
  isLoading: boolean;
  // Optional: If we want to clear files from parent, e.g., when a set is removed.
  // However, typically FileUpload manages its own internal selection until "onFilesSelected"
  // initialFiles?: UploadedImageFile[]; 
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelected, maxFiles = 10, isLoading /*, initialFiles = [] */ }) => {
  const [selectedFiles, setSelectedFiles] = useState<UploadedImageFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const nextFileId = useRef(0); 
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for the file input

  // Effect to clear selected files if isLoading becomes false (e.g. analysis complete/cancelled for this set)
  // This might be too aggressive if user wants to re-analyze same files.
  // For now, files stay selected until user changes them or removes the analysis point.
  // If `initialFiles` prop was used and changed, we could sync here:
  // useEffect(() => {
  //   setSelectedFiles(initialFiles);
  //   nextFileId.current = initialFiles.length; // rough reset if needed
  // }, [initialFiles]);


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
            const base64 = await convertFileToBase64(file);
            const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
            newProcessedFiles.push({
                id: `file-${nextFileId.current++}`, // Ensure unique IDs even across multiple FileUpload instances
                name: file.name,
                type: file.type,
                base64: base64.split(',')[1],
                previewUrl,
            });
        } catch (e) {
            localError = (localError ? localError + "\n" : "") + `${file.name} の処理中にエラーが発生しました。`;
        }
    }
    
    setSelectedFiles(newProcessedFiles); 
    onFilesSelected(newProcessedFiles);   

    if (localError) setError(localError);

    // Don't reset event.target.value here. If the user re-selects the same file after an error or modification,
    // the onChange event might not fire. It's generally better to let the browser handle this.
    // If a true "clear" button for the input is needed, it's handled differently.
  }, [maxFiles, onFilesSelected]);


  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const removeFile = (fileIdToRemove: string) => {
    const updatedFiles = selectedFiles.filter(file => file.id !== fileIdToRemove);
    setSelectedFiles(updatedFiles);
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


  return (
    <div className="w-full py-4"> {/* Removed p-6, bg-white, shadow-md, rounded-lg from here, will be handled by parent div in App.tsx */}
      <label htmlFor={`file-upload-input-${React.useId()}`} className="block text-sm font-medium text-gray-700 mb-1"> {/* Use useId for unique label association */}
        {fileInputLabel}
      </label>
      <input
        id={`file-upload-input-${React.useId()}`} // Ensure unique ID
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        onChange={handleFileChange}
        disabled={isLoading}
        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
        aria-describedby={error ? `file-upload-error-${React.useId()}` : undefined}
      />
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
                {!isLoading && (
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

