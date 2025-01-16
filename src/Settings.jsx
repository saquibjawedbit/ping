import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'

function Settings({ onClose }) {
  const [whitelistedDomains, setWhitelistedDomains] = useState([]);
  const [blockedDomains, setBlockedDomains] = useState([]);

  useEffect(() => {
    loadDomains();
  }, []);

  const loadDomains = async () => {
    const result = await chrome.storage.local.get(['whitelistedDomains', 'blockedDomains']);
    setWhitelistedDomains(result.whitelistedDomains || []);
    setBlockedDomains(result.blockedDomains || []);
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
        </div>
      </div>
    </div>
  );
}
Settings.propTypes = {
  onClose: PropTypes.func.isRequired
};

export default Settings;
