import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'

function Settings({ onClose }) {
  const [whitelistedDomains, setWhitelistedDomains] = useState([]);
  const [blockedDomains, setBlockedDomains] = useState([]);
  const [blockedFileTypes, setBlockedFileTypes] = useState([]);
  const [newFileType, setNewFileType] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const result = await chrome.storage.local.get([
      'whitelistedDomains', 
      'blockedDomains',
      'blockedFileTypes'
    ]);
    setWhitelistedDomains(result.whitelistedDomains || []);
    setBlockedDomains(result.blockedDomains || []);
    setBlockedFileTypes(result.blockedFileTypes || []);
  };

  const removeDomain = async (domain, type) => {
    if (type === 'whitelist') {
      const updated = whitelistedDomains.filter(d => d !== domain);
      await chrome.storage.local.set({ whitelistedDomains: updated });
      setWhitelistedDomains(updated);
    } else {
      const updated = blockedDomains.filter(d => d !== domain);
      await chrome.storage.local.set({ blockedDomains: updated });
      setBlockedDomains(updated);
    }
  };

  const removeFileType = async (fileType) => {
    const updated = blockedFileTypes.filter(t => t !== fileType);
    await chrome.storage.local.set({ blockedFileTypes: updated });
    setBlockedFileTypes(updated);
  };

  const addFileType = async (e) => {
    e.preventDefault();
    if (!newFileType || blockedFileTypes.includes(newFileType)) return;
    
    const updated = [...blockedFileTypes, newFileType.toLowerCase()];
    await chrome.storage.local.set({ blockedFileTypes: updated });
    setBlockedFileTypes(updated);
    setNewFileType('');
  };

  return (
    <div className="settings-overlay">
      <div className="settings-content">
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="domains-section">
          <div className="domain-list">
            <h3>Trusted Domains</h3>
            {whitelistedDomains.map(domain => (
              <div key={domain} className="domain-item trusted">
                <span>{domain}</span>
                <button onClick={() => removeDomain(domain, 'whitelist')}>×</button>
              </div>
            ))}
            {whitelistedDomains.length === 0 && (
              <p className="empty-message">No trusted domains</p>
            )}
          </div>

          <div className="domain-list">
            <h3>Blocked Domains</h3>
            {blockedDomains.map(domain => (
              <div key={domain} className="domain-item blocked">
                <span>{domain}</span>
                <button onClick={() => removeDomain(domain, 'blocked')}>×</button>
              </div>
            ))}
            {blockedDomains.length === 0 && (
              <p className="empty-message">No blocked domains</p>
            )}
          </div>

          <div className="file-types-section">
            <h3>Blocked File Types</h3>
            <form onSubmit={addFileType} className="add-file-type">
              <input
                type="text"
                value={newFileType}
                onChange={(e) => setNewFileType(e.target.value)}
                placeholder="Enter file extension (e.g., pdf)"
                pattern="[a-zA-Z0-9]+"
              />
              <button type="submit">Add</button>
            </form>
            <div className="file-types-list">
              {blockedFileTypes.map(type => (
                <div key={type} className="file-type-item">
                  <span>.{type}</span>
                  <button onClick={() => removeFileType(type)}>×</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
Settings.propTypes = {
  onClose: PropTypes.func.isRequired
};

export default Settings;
