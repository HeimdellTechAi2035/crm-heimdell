import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Upload, FileCode, Database, CheckCircle, AlertTriangle, Cpu, Zap, ArrowRight, RefreshCw } from 'lucide-react';

export default function ImportsPage() {
  const [step, setStep] = useState<'upload' | 'mapping' | 'progress' | 'complete'>('upload');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<any>(null);
  const [mapping, setMapping] = useState<any>({
    leadMapping: {},
    companyMapping: {},
    duplicateHandling: 'skip',
    generateProfiles: true,
  });

  // Get import history
  const { data: importsHistory } = useQuery({
    queryKey: ['imports'],
    queryFn: () => api.getImports(),
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadCSV(file),
    onSuccess: (data) => {
      setImportData(data);
      setStep('mapping');
    },
  });

  // Submit mapping mutation
  const mappingMutation = useMutation({
    mutationFn: (data: { importJobId: string; mapping: any }) =>
      api.submitImportMapping(data.importJobId, data.mapping),
    onSuccess: () => {
      setStep('progress');
      // Simulate progress for demo
      setTimeout(() => setStep('complete'), 3000);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handleUpload = () => {
    if (uploadedFile) {
      uploadMutation.mutate(uploadedFile);
    }
  };

  const handleMappingSubmit = () => {
    if (importData) {
      mappingMutation.mutate({
        importJobId: importData.importJobId,
        mapping,
      });
    }
  };

  const handleFieldMapping = (entity: 'lead' | 'company', field: string, csvColumn: string) => {
    const mappingKey = entity === 'lead' ? 'leadMapping' : 'companyMapping';
    setMapping((prev: any) => ({
      ...prev,
      [mappingKey]: {
        ...prev[mappingKey],
        [field]: csvColumn || undefined,
      },
    }));
  };

  const steps = [
    { id: 'upload', label: 'UPLOAD', icon: Upload },
    { id: 'mapping', label: 'MAPPING', icon: FileCode },
    { id: 'progress', label: 'PROCESSING', icon: Cpu },
    { id: 'complete', label: 'COMPLETE', icon: CheckCircle },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === step);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="hud-corner">
        <h1 className="text-4xl font-['Orbitron'] font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400">
          DATA UPLINK
        </h1>
        <p className="text-cyan-400/60 font-['Share_Tech_Mono'] text-sm mt-1 tracking-wider">
          NEURAL IMPORT INTERFACE // CSV DATA TRANSFER PROTOCOL
        </p>
      </div>

      {/* Progress Steps */}
      <div className="holo-card rounded-lg p-6">
        <div className="flex items-center justify-between">
          {steps.map((s, index) => {
            const Icon = s.icon;
            const isActive = s.id === step;
            const isCompleted = index < currentStepIndex;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <div className={`flex items-center gap-3 ${isActive ? 'opacity-100' : isCompleted ? 'opacity-70' : 'opacity-30'}`}>
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center border transition-all ${
                    isActive 
                      ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_20px_rgba(0,255,255,0.3)]' 
                      : isCompleted 
                        ? 'bg-green-500/20 border-green-400' 
                        : 'bg-black/30 border-cyan-500/20'
                  }`}>
                    <Icon className={`h-6 w-6 ${isActive ? 'text-cyan-400' : isCompleted ? 'text-green-400' : 'text-cyan-400/50'}`} />
                  </div>
                  <div>
                    <div className={`font-['Orbitron'] text-xs tracking-wider ${isActive ? 'text-cyan-400' : isCompleted ? 'text-green-400' : 'text-cyan-400/50'}`}>
                      PHASE {index + 1}
                    </div>
                    <div className={`font-['Share_Tech_Mono'] text-sm ${isActive ? 'text-cyan-400 neon-text' : isCompleted ? 'text-green-400' : 'text-cyan-400/30'}`}>
                      {s.label}
                    </div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-4 ${index < currentStepIndex ? 'bg-green-400' : 'bg-cyan-500/20'}`}>
                    <div className={`h-full ${index < currentStepIndex ? 'bg-green-400' : isActive ? 'bg-gradient-to-r from-cyan-400 to-transparent animate-pulse' : ''}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upload Step */}
      {step === 'upload' && (
        <div className="holo-card rounded-lg overflow-hidden">
          <div className="border-b border-cyan-500/20 p-4 flex items-center gap-3">
            <Upload className="h-5 w-5 text-cyan-400 glow-icon" />
            <span className="font-['Orbitron'] text-sm tracking-wider text-cyan-400">DATA TRANSFER INTERFACE</span>
          </div>
          <div className="p-6 space-y-6">
            {/* Upload Zone */}
            <label
              htmlFor="file-upload"
              className={`block border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all ${
                uploadedFile 
                  ? 'border-green-400/50 bg-green-500/5' 
                  : 'border-cyan-500/30 hover:border-cyan-400/50 hover:bg-cyan-500/5'
              }`}
            >
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <div className="space-y-4">
                <div className={`w-20 h-20 mx-auto rounded-lg flex items-center justify-center ${
                  uploadedFile ? 'bg-green-500/20 border border-green-400/50' : 'bg-cyan-500/10 border border-cyan-500/30'
                }`}>
                  {uploadedFile ? (
                    <CheckCircle className="h-10 w-10 text-green-400" />
                  ) : (
                    <Database className="h-10 w-10 text-cyan-400" />
                  )}
                </div>
                {uploadedFile ? (
                  <div>
                    <div className="font-['Orbitron'] text-lg text-green-400">{uploadedFile.name}</div>
                    <div className="font-['Share_Tech_Mono'] text-xs text-green-400/60 mt-1">
                      SIZE: {(uploadedFile.size / 1024).toFixed(1)} KB // READY FOR TRANSFER
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="font-['Orbitron'] text-lg text-cyan-400">SELECT DATA FILE</div>
                    <div className="font-['Share_Tech_Mono'] text-xs text-cyan-400/50 mt-1">
                      SUPPORTED FORMATS: CSV, TXT // MAX SIZE: 10MB
                    </div>
                  </div>
                )}
              </div>
            </label>

            {/* Upload Button */}
            {uploadedFile && (
              <div className="space-y-4">
                <div className="data-panel rounded p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileCode className="h-5 w-5 text-cyan-400" />
                    <div>
                      <div className="font-['Rajdhani'] text-cyan-400">{uploadedFile.name}</div>
                      <div className="font-['Share_Tech_Mono'] text-xs text-cyan-400/50">
                        {(uploadedFile.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setUploadedFile(null)}
                    className="text-red-400 hover:text-red-300 font-['Orbitron'] text-xs"
                  >
                    REMOVE
                  </button>
                </div>

                <button
                  onClick={handleUpload}
                  disabled={uploadMutation.isPending}
                  className="cyber-btn w-full py-4 flex items-center justify-center gap-3"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <RefreshCw className="h-5 w-5 animate-spin" />
                      <span>UPLOADING...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-5 w-5" />
                      <span>INITIATE TRANSFER</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {uploadMutation.isError && (
              <div className="data-panel rounded p-4 border-red-500/30 bg-red-500/10">
                <div className="flex items-center gap-3 text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                  <div className="font-['Rajdhani']">
                    {(uploadMutation.error as any)?.message || 'Transfer failed - check data integrity'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mapping Step */}
      {step === 'mapping' && importData && (
        <div className="space-y-6">
          <div className="holo-card rounded-lg overflow-hidden">
            <div className="border-b border-cyan-500/20 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileCode className="h-5 w-5 text-cyan-400 glow-icon" />
                <span className="font-['Orbitron'] text-sm tracking-wider text-cyan-400">FIELD MAPPING CONFIGURATION</span>
              </div>
              <span className="font-['Share_Tech_Mono'] text-xs text-cyan-400/50">
                {importData.previewRows?.length || 0} RECORDS DETECTED
              </span>
            </div>

            <div className="p-6 space-y-6">
              {/* Preview Table */}
              <div>
                <div className="font-['Orbitron'] text-xs text-cyan-400/60 mb-3 tracking-wider">DATA PREVIEW</div>
                <div className="overflow-x-auto">
                  <table className="cyber-table w-full">
                    <thead>
                      <tr>
                        {importData.headers?.map((header: string) => (
                          <th key={header} className="px-4 py-3 text-left">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importData.previewRows?.slice(0, 3).map((row: any, i: number) => (
                        <tr key={i} className="radar-scan">
                          {importData.headers?.map((header: string) => (
                            <td key={header} className="px-4 py-3 text-cyan-400/70 font-['Rajdhani'] text-sm">
                              {row[header] || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mapping Sections */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Lead Mapping */}
                <div className="data-panel rounded p-4">
                  <div className="font-['Orbitron'] text-sm text-cyan-400 mb-4 tracking-wider">LEAD DATA MAPPING</div>
                  <div className="space-y-3">
                    {['firstName', 'lastName', 'email', 'phone', 'title'].map((field) => (
                      <div key={field} className="flex items-center gap-3">
                        <span className="font-['Share_Tech_Mono'] text-xs text-cyan-400/60 w-24">{field.toUpperCase()}</span>
                        <ArrowRight className="h-4 w-4 text-cyan-400/30" />
                        <select
                          className="cyber-input flex-1 py-2 px-3 rounded text-sm"
                          value={mapping.leadMapping[field] || ''}
                          onChange={(e) => handleFieldMapping('lead', field, e.target.value)}
                        >
                          <option value="">-- Select Column --</option>
                          {importData.headers?.map((header: string) => (
                            <option key={header} value={header}>{header}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Company Mapping */}
                <div className="data-panel rounded p-4">
                  <div className="font-['Orbitron'] text-sm text-cyan-400 mb-4 tracking-wider">COMPANY DATA MAPPING</div>
                  <div className="space-y-3">
                    {['name', 'website', 'industry', 'location'].map((field) => (
                      <div key={field} className="flex items-center gap-3">
                        <span className="font-['Share_Tech_Mono'] text-xs text-cyan-400/60 w-24">{field.toUpperCase()}</span>
                        <ArrowRight className="h-4 w-4 text-cyan-400/30" />
                        <select
                          className="cyber-input flex-1 py-2 px-3 rounded text-sm"
                          value={mapping.companyMapping[field] || ''}
                          onChange={(e) => handleFieldMapping('company', field, e.target.value)}
                        >
                          <option value="">-- Select Column --</option>
                          {importData.headers?.map((header: string) => (
                            <option key={header} value={header}>{header}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Options */}
              <div className="data-panel rounded p-4">
                <div className="font-['Orbitron'] text-sm text-cyan-400 mb-4 tracking-wider">IMPORT OPTIONS</div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <span className="font-['Share_Tech_Mono'] text-xs text-cyan-400/60">DUPLICATE HANDLING</span>
                    <select
                      className="cyber-input flex-1 py-2 px-3 rounded text-sm"
                      value={mapping.duplicateHandling}
                      onChange={(e) => setMapping((prev: any) => ({ ...prev, duplicateHandling: e.target.value }))}
                    >
                      <option value="skip">SKIP DUPLICATES</option>
                      <option value="update">UPDATE EXISTING</option>
                      <option value="create">CREATE NEW</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mapping.generateProfiles}
                      onChange={(e) => setMapping((prev: any) => ({ ...prev, generateProfiles: e.target.checked }))}
                      className="w-5 h-5 rounded border-cyan-500/30 bg-black/50 text-cyan-400 focus:ring-cyan-400"
                    />
                    <span className="font-['Share_Tech_Mono'] text-xs text-cyan-400/60">GENERATE AI PROFILES</span>
                  </label>
                </div>
              </div>

              {/* Submit */}
              <button
                onClick={handleMappingSubmit}
                disabled={mappingMutation.isPending}
                className="cyber-btn w-full py-4 flex items-center justify-center gap-3"
              >
                {mappingMutation.isPending ? (
                  <>
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    <span>PROCESSING...</span>
                  </>
                ) : (
                  <>
                    <Cpu className="h-5 w-5" />
                    <span>EXECUTE IMPORT</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Step */}
      {step === 'progress' && (
        <div className="holo-card rounded-lg overflow-hidden">
          <div className="border-b border-cyan-500/20 p-4 flex items-center gap-3">
            <Cpu className="h-5 w-5 text-cyan-400 glow-icon animate-pulse" />
            <span className="font-['Orbitron'] text-sm tracking-wider text-cyan-400">NEURAL PROCESSING</span>
          </div>
          <div className="p-12 text-center">
            <div className="cyber-spinner mx-auto mb-6" />
            <div className="font-['Orbitron'] text-2xl text-cyan-400 mb-2">IMPORTING DATA</div>
            <div className="font-['Share_Tech_Mono'] text-sm text-cyan-400/50 mb-8">
              Processing records through neural network...
            </div>
            <div className="max-w-md mx-auto">
              <div className="cyber-progress h-3 rounded-full">
                <div className="cyber-progress-bar h-full rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
              <div className="flex justify-between mt-2">
                <span className="font-['Share_Tech_Mono'] text-xs text-cyan-400/50">0%</span>
                <span className="font-['Share_Tech_Mono'] text-xs text-cyan-400/50">100%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complete Step */}
      {step === 'complete' && (
        <div className="holo-card rounded-lg overflow-hidden">
          <div className="border-b border-cyan-500/20 p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-400 glow-icon" />
            <span className="font-['Orbitron'] text-sm tracking-wider text-green-400">TRANSFER COMPLETE</span>
          </div>
          <div className="p-12 text-center">
            <div className="w-24 h-24 mx-auto rounded-full bg-green-500/20 border border-green-400/50 flex items-center justify-center mb-6">
              <CheckCircle className="h-12 w-12 text-green-400" />
            </div>
            <div className="font-['Orbitron'] text-2xl text-green-400 mb-2">IMPORT SUCCESSFUL</div>
            <div className="font-['Share_Tech_Mono'] text-sm text-green-400/50 mb-8">
              All records have been processed and integrated into the system
            </div>
            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-8">
              <div className="data-panel rounded p-4">
                <div className="stat-value text-2xl text-cyan-400">127</div>
                <div className="font-['Share_Tech_Mono'] text-[10px] text-cyan-400/50">LEADS</div>
              </div>
              <div className="data-panel rounded p-4">
                <div className="stat-value text-2xl text-purple-400">23</div>
                <div className="font-['Share_Tech_Mono'] text-[10px] text-purple-400/50">COMPANIES</div>
              </div>
              <div className="data-panel rounded p-4">
                <div className="stat-value text-2xl text-green-400">0</div>
                <div className="font-['Share_Tech_Mono'] text-[10px] text-green-400/50">ERRORS</div>
              </div>
            </div>
            <button
              onClick={() => {
                setStep('upload');
                setUploadedFile(null);
                setImportData(null);
              }}
              className="cyber-btn px-8 py-3"
            >
              NEW IMPORT
            </button>
          </div>
        </div>
      )}

      {/* Import History */}
      <div className="holo-card rounded-lg overflow-hidden">
        <div className="border-b border-cyan-500/20 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-cyan-400 glow-icon" />
            <span className="font-['Orbitron'] text-sm tracking-wider text-cyan-400">TRANSFER HISTORY</span>
          </div>
        </div>
        <div className="p-4">
          {importsHistory?.imports?.length > 0 ? (
            <div className="space-y-2">
              {importsHistory.imports.map((imp: any) => (
                <div key={imp.id} className="data-panel rounded p-4 flex items-center justify-between radar-scan">
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${
                      imp.status === 'COMPLETED' ? 'bg-green-400' :
                      imp.status === 'FAILED' ? 'bg-red-400' : 'bg-orange-400 animate-pulse'
                    }`} />
                    <div>
                      <div className="font-['Rajdhani'] text-cyan-400">{imp.filename}</div>
                      <div className="font-['Share_Tech_Mono'] text-xs text-cyan-400/50">
                        {new Date(imp.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`cyber-badge ${
                      imp.status === 'COMPLETED' ? 'text-green-400' :
                      imp.status === 'FAILED' ? 'text-red-400' : 'text-orange-400'
                    }`}>
                      {imp.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Database className="h-12 w-12 mx-auto text-cyan-400/20 mb-3" />
              <div className="font-['Rajdhani'] text-cyan-400/50">No previous transfers recorded</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { ImportsPage as Imports };
