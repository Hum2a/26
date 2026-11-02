import type { TrollKindName } from "@26/shared";
import type { IconifyIcon } from "@iconify/react/dist/offline";
import smartphone from "@iconify-icons/lucide/smartphone";
import shuffle from "@iconify-icons/lucide/shuffle";
import venetianMask from "@iconify-icons/lucide/venetian-mask";
import coins from "@iconify-icons/lucide/coins";
import projector from "@iconify-icons/lucide/projector";
import bomb from "@iconify-icons/lucide/bomb";
import phone from "@iconify-icons/lucide/phone";
import zap from "@iconify-icons/lucide/zap";
import move from "@iconify-icons/lucide/move";
import repeat from "@iconify-icons/lucide/repeat";
import eyeOff from "@iconify-icons/lucide/eye-off";
import dice from "@iconify-icons/lucide/dices";
import keyboard from "@iconify-icons/lucide/keyboard";
import mic from "@iconify-icons/lucide/mic";
import music from "@iconify-icons/lucide/music";
import megaphone from "@iconify-icons/lucide/megaphone";
import rotateCcw from "@iconify-icons/lucide/rotate-ccw";
import flipHorizontal from "@iconify-icons/lucide/flip-horizontal";
import waves from "@iconify-icons/lucide/waves";
import type from "@iconify-icons/lucide/type";
import flashlight from "@iconify-icons/lucide/flashlight";
import circleDot from "@iconify-icons/lucide/circle-dot";
import monitorX from "@iconify-icons/lucide/monitor-x";
import download from "@iconify-icons/lucide/download";
import bot from "@iconify-icons/lucide/bot";
import bell from "@iconify-icons/lucide/bell";
import partyPopper from "@iconify-icons/lucide/party-popper";
import disc from "@iconify-icons/lucide/disc";
import video from "@iconify-icons/lucide/video";
import batteryLow from "@iconify-icons/lucide/battery-low";
import share from "@iconify-icons/lucide/share-2";
import thermometer from "@iconify-icons/lucide/thermometer";
import eye from "@iconify-icons/lucide/eye";
import messageCircle from "@iconify-icons/lucide/message-circle";
import languages from "@iconify-icons/lucide/languages";
import slidersHorizontal from "@iconify-icons/lucide/sliders-horizontal";
import undo from "@iconify-icons/lucide/undo-2";
import spellCheck from "@iconify-icons/lucide/spell-check";
import scissors from "@iconify-icons/lucide/scissors";
import vibrate from "@iconify-icons/lucide/vibrate";
import tag from "@iconify-icons/lucide/tag";
import userX from "@iconify-icons/lucide/user-x";
import trendingDown from "@iconify-icons/lucide/trending-down";
import rewind from "@iconify-icons/lucide/rewind";
import mic2 from "@iconify-icons/lucide/mic-vocal";
import logOut from "@iconify-icons/lucide/log-out";
import zoomIn from "@iconify-icons/lucide/zoom-in";
import handCoins from "@iconify-icons/lucide/hand-coins";
import heartHandshake from "@iconify-icons/lucide/heart-handshake";
import split from "@iconify-icons/lucide/split";
import vote from "@iconify-icons/lucide/vote";
import quote from "@iconify-icons/lucide/quote";
import userRound from "@iconify-icons/lucide/user-round";

export type TrollGroupId = "chaos" | "sabotage" | "identity" | "points" | "stage";

/** Groups shown on the Troll tab, in this order. `hue` picks the group colour. */
export const trollGroups: readonly {
  id: TrollGroupId;
  label: string;
  blurb: string;
  icon: IconifyIcon;
  hue: number;
}[] = [
  {
    id: "chaos",
    label: "Phone chaos",
    blurb: "Takes over their screen for a few seconds.",
    icon: bomb,
    hue: 0,
  },
  {
    id: "sabotage",
    label: "Sabotage",
    blurb: "Messes with their answer while they play.",
    icon: shuffle,
    hue: 1,
  },
  {
    id: "identity",
    label: "Identity",
    blurb: "Changes who they are on every screen.",
    icon: venetianMask,
    hue: 3,
  },
  {
    id: "points",
    label: "Points",
    blurb: "Moves or risks their points this question.",
    icon: coins,
    hue: 2,
  },
  {
    id: "stage",
    label: "Big screen",
    blurb: "Puts them on the projector.",
    icon: projector,
    hue: 5,
  },
];

export type TrollMeta = { group: TrollGroupId; icon: IconifyIcon; blurb: string };

/** What each troll does, in a line a guest can read in one glance. */
export const trollMeta: Record<TrollKindName, TrollMeta> = {
  invasion: { group: "chaos", icon: smartphone, blurb: "Their screen gets invaded." },
  netanyahu: { group: "chaos", icon: userRound, blurb: "An uninvited guest appears." },
  call: { group: "chaos", icon: phone, blurb: "Mum rings mid-question." },
  crack: { group: "chaos", icon: zap, blurb: "Their screen looks smashed." },
  australia: {
    group: "chaos",
    icon: rotateCcw,
    blurb: "Their phone turns upside down.",
  },
  mirror: { group: "chaos", icon: flipHorizontal, blurb: "Everything is mirrored." },
  jelly: { group: "chaos", icon: waves, blurb: "Their screen wobbles like jelly." },
  "comic-sans": { group: "chaos", icon: type, blurb: "Comic Sans. Everywhere." },
  "lights-out": {
    group: "chaos",
    icon: flashlight,
    blurb: "Only a torch beam to see by.",
  },
  "bubble-wrap": { group: "chaos", icon: circleDot, blurb: "Pop it all to escape." },
  "fake-crash": { group: "chaos", icon: monitorX, blurb: "A blue screen of doom." },
  "forced-update": {
    group: "chaos",
    icon: download,
    blurb: "An update they cannot skip.",
  },
  captcha: { group: "chaos", icon: bot, blurb: "Prove they are not a robot." },
  "notification-storm": {
    group: "chaos",
    icon: bell,
    blurb: "Endless fake notifications.",
  },
  confetti: { group: "chaos", icon: partyPopper, blurb: "A birthday confetti blast." },
  dvd: { group: "chaos", icon: disc, blurb: "Catch the bouncing logo." },
  "screen-recording": {
    group: "chaos",
    icon: video,
    blurb: "A fake recording banner.",
  },
  "low-battery": { group: "chaos", icon: batteryLow, blurb: "Their battery hits 1%." },
  airdrop: { group: "chaos", icon: share, blurb: "AirDrop requests that never stop." },
  overheating: {
    group: "chaos",
    icon: thermometer,
    blurb: "Their phone needs to cool down.",
  },
  "answer-viewers": {
    group: "chaos",
    icon: eye,
    blurb: "Strangers watch them answer.",
  },
  "typing-dots": {
    group: "chaos",
    icon: messageCircle,
    blurb: "Someone is always typing…",
  },
  "haptic-storm": {
    group: "chaos",
    icon: vibrate,
    blurb: "Their phone will not stop buzzing.",
  },
  "fake-exit": {
    group: "chaos",
    icon: logOut,
    blurb: "Tells them they left the party.",
  },
  "fake-last": {
    group: "chaos",
    icon: trendingDown,
    blurb: "Says they are last. Apparently.",
  },
  yield: { group: "sabotage", icon: move, blurb: "Their send button runs away." },
  reshuffle: { group: "sabotage", icon: dice, blurb: "Their options keep moving." },
  translate: { group: "sabotage", icon: languages, blurb: "Options in Pig Latin." },
  "slider-drift": {
    group: "sabotage",
    icon: slidersHorizontal,
    blurb: "A possessed slider.",
  },
  "reverse-typing": {
    group: "sabotage",
    icon: undo,
    blurb: "Letters go in backwards.",
  },
  autocorrect: {
    group: "sabotage",
    icon: spellCheck,
    blurb: "Very helpful corrections.",
  },
  "char-limit": {
    group: "sabotage",
    icon: scissors,
    blurb: "Twelve characters, tops.",
  },
  swap: { group: "identity", icon: repeat, blurb: "Swap your name with theirs." },
  "temp-nickname": {
    group: "identity",
    icon: tag,
    blurb: "A silly new name for a while.",
  },
  "guest-14": { group: "identity", icon: userX, blurb: "Nobody knows who they are." },
  misattributed: {
    group: "identity",
    icon: quote,
    blurb: "Credit them with someone else’s answer.",
  },
  "hide-score": {
    group: "points",
    icon: eyeOff,
    blurb: "They cannot see their own score.",
  },
  double: { group: "points", icon: dice, blurb: "Double or nothing on this one." },
  steal: { group: "points", icon: handCoins, blurb: "Take half their points." },
  "robin-hood": {
    group: "points",
    icon: heartHandshake,
    blurb: "Their points go to last place.",
  },
  share: { group: "points", icon: split, blurb: "They split their points." },
  typing: { group: "stage", icon: keyboard, blurb: "The big screen sees them type." },
  voice: { group: "stage", icon: mic, blurb: "Your voice clip plays at the reveal." },
  theme: { group: "stage", icon: music, blurb: "They get a theme song." },
  sponsor: { group: "stage", icon: megaphone, blurb: "A word from our sponsor." },
  replay: { group: "stage", icon: rewind, blurb: "Their answer, replayed on screen." },
  speech: { group: "stage", icon: mic2, blurb: "They must give a speech." },
  "zoom-photo": {
    group: "stage",
    icon: zoomIn,
    blurb: "One of their photos, up close.",
  },
  "public-vote": {
    group: "stage",
    icon: vote,
    blurb: "Their vote goes on the big screen.",
  },
};

export function trollGroupOf(kind: string) {
  const meta = trollMeta[kind as TrollKindName];
  return trollGroups.find((group) => group.id === meta?.group) ?? trollGroups[0]!;
}
