/**
 * Every file a phone gag plays or shows, under `apps/web/public/assets/`.
 * The `trolls/` files keep their asset-pack names; their sources, licences and
 * edits are in `trolls/CREDITS.txt`. They are deliberate stand-ins: a stock
 * painting for Mum, an American dialogue clip for her voice, a bubble pop and a
 * generic chime. None is a real family member or an Apple sound.
 */
const pack = "/assets/trolls";

export const trollAssets = {
  netanyahuFace: "/assets/netanyahu.webp",
  netanyahuMusic: "/assets/netanyahu.mp3",
  glassCrack: "/assets/glass-crack.mp3",
  mumRingtone: `${pack}/01_call-from-mum_ringtone.mp3`,
  mumVoice: `${pack}/02_call-from-mum_voice-line.mp3`,
  mumPhoto: `${pack}/03_call-from-mum_photo_web.jpg`,
  bubblePop: `${pack}/04_bubble-wrap_pop.mp3`,
  notificationDing: `${pack}/05b_notification-storm_ding-alt.mp3`,
  notificationDingFallback: `${pack}/05_notification-storm_ding.mp3`,
  partyHorn: `${pack}/06_confetti-cannon_party-horn.mp3`,
  crashError: `${pack}/07_fake-crash_error.mp3`,
  airdropChime: `${pack}/08_airdrop-spam_generic-chime.mp3`,
  batteryChirp: `${pack}/09_low-battery_chirp.mp3`,
  sadTrombone: `${pack}/10_fake-last-place_sad-trombone.mp3`,
  doorSlam: `${pack}/11_fake-exit_door-slam.mp3`,
} as const;
