import { useState, useEffect } from 'react'
import Companion from './Companion'
import Settings from './Settings'

function App() {
  const [route, setRoute] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => {
      console.log('Hash changed to:', window.location.hash);
      setRoute(window.location.hash);
    };

    // Initial check
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Use includes to be more resilient to trailing slashes or other variations
  if (route.includes('settings')) {
    return (
      <div className="settings-page">
        <Settings />
      </div>
    );
  }

  if (route.includes('chat')) {
    return <Companion mode="workspace" />;
  }

  return <Companion mode="pet" />;
}

export default App;
