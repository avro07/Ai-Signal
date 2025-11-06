
const ALERT_SOUND_URL = 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg';

let alertAudio: HTMLAudioElement | null = null;

try {
  alertAudio = new Audio(ALERT_SOUND_URL);
} catch (e) {
  console.error("Could not create audio element for notifications.");
  alertAudio = null;
}

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) {
    alert('This browser does not support desktop notification');
    return 'denied';
  }
  return await Notification.requestPermission();
};

export const showNotification = (title: string, options?: NotificationOptions, withSound: boolean = false): void => {
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      icon: '/favicon.ico', // You might want to add a proper icon in public folder
      ...options,
    });
    
    if (withSound && alertAudio) {
      alertAudio.play().catch(e => console.error("Error playing notification sound:", e));
    }
    
    // Auto-close notification after 5 seconds
    setTimeout(() => notification.close(), 5000);
  }
};
   