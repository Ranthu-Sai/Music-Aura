export function GetCurrentDaytime() {
  const now = new Date(),
    hour = now.getHours();

  const morning = hour >= 4 && hour <= 11,
    afternoon = hour >= 12 && hour <= 16,
    evening = hour >= 17 && hour <= 20,
    night = hour >= 21 || hour <= 3;

  if (morning) {
    return 'Morning Vibes ✨';
  } else if (afternoon) {
    return 'Afternoon Vibes ✨';
  } else if (evening) {
    return "Evening Chill's ✨";
  } else if (night) {
    return "Lofi Night's 💫";
  }
}
