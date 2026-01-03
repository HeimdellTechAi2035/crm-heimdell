import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { useResetAppData } from '@/lib/reset-app-data';

interface DeleteAllDataModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DeleteAllDataModal({ isOpen, onClose }: DeleteAllDataModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const navigate = useNavigate();
  const resetAppData = useResetAppData();

  const CONFIRMATION_WORD = 'DELETE';

  const handleDelete = async () => {
    if (confirmText !== CONFIRMATION_WORD) return;
    
    setIsDeleting(true);
    setResult(null);

    try {
      const resetResult = await resetAppData();
      
      if (resetResult.success) {
        setResult({ success: true, message: 'All data has been permanently deleted.' });
        
        // Wait briefly to show success, then redirect
        setTimeout(() => {
          onClose();
          navigate('/');
          // Force a full page reload to reset all in-memory state
          window.location.reload();
        }, 1500);
      } else {
        setResult({ 
          success: false, 
          message: `Some data could not be cleared: ${resetResult.errors.join(', ')}` 
        });
      }
    } catch (err) {
      setResult({ 
        success: false, 
        message: `Delete failed: ${err}` 
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setConfirmText('');
      setResult(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-gray-900 border border-red-500/30 rounded-lg shadow-[0_0_50px_rgba(255,0,0,0.2)]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-red-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <h2 className="font-['Orbitron'] text-lg text-red-400">DANGER ZONE</h2>
              <p className="font-['Share_Tech_Mono'] text-[10px] text-red-400/60">IRREVERSIBLE ACTION</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="text-gray-300 font-['Rajdhani']">
            <p className="font-bold text-red-400 mb-2">This will permanently delete:</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-400">
              <li>All leads and contacts</li>
              <li>All companies</li>
              <li>All deals and pipeline data</li>
              <li>All tasks and activities</li>
              <li>All import history</li>
              <li>All settings and preferences</li>
            </ul>
          </div>

          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded">
            <p className="text-red-400 text-sm font-['Share_Tech_Mono']">
              ⚠️ This action cannot be undone. All data will be permanently erased from this device.
            </p>
          </div>

          {/* Confirmation Input */}
          <div className="space-y-2">
            <label className="block text-sm font-['Share_Tech_Mono'] text-gray-400">
              Type <span className="text-red-400 font-bold">{CONFIRMATION_WORD}</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              disabled={isDeleting}
              placeholder="Type DELETE to confirm"
              className="w-full px-4 py-3 bg-black border border-gray-700 rounded text-white font-['Share_Tech_Mono'] focus:border-red-500 focus:outline-none disabled:opacity-50"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {/* Result Message */}
          {result && (
            <div className={`p-3 rounded border ${
              result.success 
                ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              <p className="text-sm font-['Share_Tech_Mono']">{result.message}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-gray-800">
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="flex-1 px-4 py-3 bg-gray-800 text-gray-300 rounded font-['Orbitron'] text-sm hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            CANCEL
          </button>
          <button
            onClick={handleDelete}
            disabled={confirmText !== CONFIRMATION_WORD || isDeleting}
            className="flex-1 px-4 py-3 bg-red-600 text-white rounded font-['Orbitron'] text-sm hover:bg-red-500 transition-colors disabled:opacity-50 disabled:bg-gray-700 disabled:text-gray-500 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                DELETING...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                DELETE ALL DATA
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
