import React from 'react'

const SourceSelector = ({ 
  videoSources, 
  audioSources, 
  selectedVideoSource, 
  selectedAudioSource,
  onVideoSourceSelect, 
  onAudioSourceSelect 
}) => {
  const handleVideoSourceChange = (e) => {
    const sourceId = e.target.value
    const source = videoSources.find(s => s.id === sourceId)
    onVideoSourceSelect(source)
  }

  const handleAudioSourceChange = (e) => {
    const deviceId = e.target.value
    const source = audioSources.find(s => s.id === deviceId)
    onAudioSourceSelect(source)
  }

  return (
    <div className="source-selector">
      <div className="source-group">
        <label className="source-label">
          📺 Video Source
        </label>
        <select 
          className="source-select"
          value={selectedVideoSource?.id || ''}
          onChange={handleVideoSourceChange}
        >
          <option value="">Select screen or window...</option>
          {videoSources.map(source => (
            <option key={source.id} value={source.id}>
              {source.type === 'screen' ? '🖥️' : '🪟'} {source.name}
            </option>
          ))}
        </select>
        
        {selectedVideoSource && (
          <div className="source-preview">
            <img 
              src={selectedVideoSource.thumbnail} 
              alt={selectedVideoSource.name}
              className="source-thumbnail"
            />
            <span className="source-name">{selectedVideoSource.name}</span>
          </div>
        )}
      </div>

      <div className="source-group">
        <label className="source-label">
          🎤 Audio Source
        </label>
        <select 
          className="source-select"
          value={selectedAudioSource?.id || ''}
          onChange={handleAudioSourceChange}
        >
          <option value="">Select microphone...</option>
          {audioSources.map(source => (
            <option key={source.id} value={source.id}>
              🎤 {source.name}
            </option>
          ))}
        </select>
        
        {selectedAudioSource && (
          <div className="source-info">
            <span className="source-name">🎤 {selectedAudioSource.name}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default SourceSelector

