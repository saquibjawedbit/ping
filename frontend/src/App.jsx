import { useEffect, useState } from 'react'
import './App.css'
import Settings from './Settings'

function App() {
  const [activeTab, setActiveTab] = useState("New Tab");
  const [score, setScore] = useState(0);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showSettings, setShowSettings] = useState(false);

  const addNotification = (message, type) => {
    const newNotification = {
      id: Date.now(),
      message,
      type
    };
    setNotifications(prev => [...prev, newNotification]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
    }, 3000);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [currentData, lists] = await Promise.all([
          chrome.storage.local.get(['currentData']),
          chrome.storage.local.get(['whitelistedDomains', 'blockedDomains'])
        ]);

        if (currentData.currentData) {
          setActiveTab(currentData.currentData.domain);
          setScore(currentData.currentData.score);
          
          // Update status
          setIsWhitelisted(lists.whitelistedDomains?.includes(currentData.currentData.domain));
          setIsBlocked(lists.blockedDomains?.includes(currentData.currentData.domain));
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();

    const handleStorageChange = (changes) => {
      console.log('Storage changes:', changes);
      if (changes.currentData?.newValue) {
        setActiveTab(changes.currentData.newValue.domain);
        setScore(changes.currentData.newValue.score);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  useEffect(() => {
    // Add message listener for blocked events
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "RULE_TRIGGERED") {
        const newNotification = {
          id: Date.now(),
          message: `Blocked ${message.details.type} from ${message.details.initiator}`,
          type: 'block'
        };
        setNotifications(prev => [...prev, newNotification]);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
        }, 3000);
      }
    });
  }, []);

  const getScoreColor = (score) => {
    if (score >= 70) return '#4CAF50'
    if (score >= 40) return '#FFC107'
    return '#F44336'
  }

  const handleWhitelist = () => {
    chrome.runtime.sendMessage({
      type: "ADD_TO_WHITELIST",
      domain: activeTab
    });
    addNotification(`${activeTab} added to trusted sites`, 'success');
  };

  const handleBlock = () => {
    chrome.runtime.sendMessage({
      type: "ADD_TO_BLOCKLIST",
      domain: activeTab
    });
    addNotification(`${activeTab} added to blocked sites`, 'error');
  };

  const handleSettings = () => {
    setShowSettings(true);
  };

  return (
    <div className="container">
      {/* Notification Container */}
      <div className="notifications">
        {notifications.map(notification => (
          <div key={notification.id} className={`notification ${notification.type}`}>
            {notification.message}
          </div>
        ))}
      </div>
      <div className="score-card">
        <div 
          className="score-circle"
          style={{ 
            backgroundColor: getScoreColor(score),
            boxShadow: `0 0 20px ${getScoreColor(score)}40`
          }}
        >
          <span className="score-number">{score}</span>
          <span className="score-label">Trust Score</span>
        </div>
        <div className="domain-info">
          <h2>Current Domain</h2>
          <p className="domain-name">{activeTab}</p>
        </div>
        <div className="action-buttons">
          <button 
            className={`btn btn-whitelist ${isWhitelisted ? 'active' : ''}`} 
            onClick={handleWhitelist}
          >
            {isWhitelisted ? '✓ Trusted' : '✓ Trust'}
          </button>
          <button 
            className={`btn btn-block ${isBlocked ? 'active' : ''}`} 
            onClick={handleBlock}
          >
            {isBlocked ? '✕ Blocked' : '✕ Block'}
          </button>
          <button className="btn btn-settings" onClick={handleSettings}>
            ⚙️ Settings
          </button>
        </div>
      </div>
      <div className="details-section">
        <div className="info-box">
          <h3>Security Tips</h3>
          <ul>
            <li>Always verify the domain name</li>
            <li>Check for HTTPS connection</li>
            <li>Be cautious with downloads</li>
          </ul>
        </div>
      </div>
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  )
}

export default App
