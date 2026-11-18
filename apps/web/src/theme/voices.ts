import { useThemeId } from "./use-theme-identity";
import type { ThemeId } from "./themes";

/**
 * Each theme's voice: a few short lines of chrome flavour. They never replace
 * a score, an instruction or a state: "Locked in", "Sending…", points and
 * question copy stay the same in every theme. A voice only colours the line
 * beside them.
 *
 * - waiting: between questions on the phone.
 * - locked: under "Locked in" once the room has the answer.
 * - won: under "+N points".
 * - missed: under "No points this time".
 * - invite: the projector's call to join in the lobby.
 * - glyph: the mark beside a scored result.
 */
export type Voice = {
  waiting: string;
  locked: string;
  won: string;
  missed: string;
  invite: string;
  glyph: string;
};

/** 26 basic, and the wording every theme had before voices. */
export const defaultVoice: Voice = {
  waiting: "Waiting for the next question.",
  locked: "The room has your answer. Watch the stage.",
  won: "Nice. Check Ranks for your place.",
  missed: "Plenty more to come.",
  invite: "Join on your phone",
  glyph: "★",
};

export const voices: Record<ThemeId, Voice> = {
  "26-basic": defaultVoice,

  // Personal to 26
  "version-26": {
    waiting: "Installing the next update…",
    locked: "Change log updated. Watch the stage.",
    won: "Patch notes: you were right.",
    missed: "Known issue. Fixed next release.",
    invite: "Update to Version 26",
    glyph: "◆",
  },
  "humza-after-hours": {
    waiting: "Pouring another round…",
    locked: "On the tab. Watch the stage.",
    won: "Smooth. Very smooth.",
    missed: "Last orders on that one.",
    invite: "Come in, it's after hours",
    glyph: "☾",
  },
  "humza-os": {
    waiting: "Loading next process…",
    locked: "Input accepted. Watch the stage.",
    won: "Process exited 0. Points granted.",
    missed: "Error 404: points not found.",
    invite: "Log in to HumzaOS",
    glyph: "▣",
  },
  "main-character": {
    waiting: "Cut. Resetting for the next scene…",
    locked: "That's a wrap on your answer.",
    won: "Main character moment.",
    missed: "Plot armour failed.",
    invite: "Take your place on set",
    glyph: "♛",
  },
  "baseer-live": {
    waiting: "Back after the break…",
    locked: "Your call is on air.",
    won: "Huge round of applause.",
    missed: "Off air for that one.",
    invite: "Join the live show",
    glyph: "●",
  },
  "26-karat": {
    waiting: "Polishing the next one…",
    locked: "Hallmarked and sealed.",
    won: "Pure gold.",
    missed: "Gold-plated, not gold.",
    invite: "Step into 26 Karat",
    glyph: "◆",
  },
  "november-nights": {
    waiting: "Waiting for the next rocket…",
    locked: "Lit. Stand back and watch the stage.",
    won: "Ooh. Aah. Points.",
    missed: "Damp sparkler.",
    invite: "Wrap up warm and join",
    glyph: "✦",
  },
  "birthday-exe": {
    waiting: "Buffering cake.exe…",
    locked: "Answer.exe saved.",
    won: "Achievement unlocked.",
    missed: "Birthday.exe stopped responding.",
    invite: "Run Birthday.exe",
    glyph: "▲",
  },
  "the-humza-show": {
    waiting: "Stay tuned. Next round soon.",
    locked: "Locked. No phoning a friend.",
    won: "And the crowd goes wild!",
    missed: "So close. Applause anyway.",
    invite: "Be on The Humza Show",
    glyph: "★",
  },
  "quarter-life-deluxe": {
    waiting: "Unwrapping the bonus disc…",
    locked: "Deluxe answer secured.",
    won: "Bonus track: points.",
    missed: "Standard edition, sadly.",
    invite: "Unlock the deluxe edition",
    glyph: "✚",
  },

  // Quiz and chaos
  "friendly-sabotage": {
    waiting: "Plotting the next betrayal…",
    locked: "Sealed. No take-backs.",
    won: "Sabotage successful.",
    missed: "Sabotaged. By yourself.",
    invite: "Join the friendly sabotage",
    glyph: "✕",
  },
  "final-answer": {
    waiting: "Next question loading. No lifelines.",
    locked: "Final answer. Locked.",
    won: "That's correct!",
    missed: "Sadly, that's wrong.",
    invite: "Take the hot seat",
    glyph: "◇",
  },
  "big-red-button": {
    waiting: "Do not press anything yet…",
    locked: "Button pressed. No going back.",
    won: "Boom. Points.",
    missed: "Wrong button.",
    invite: "Don't press the big red button",
    glyph: "▲",
  },
  "high-score-club": {
    waiting: "Insert coin for the next round…",
    locked: "Score submitted.",
    won: "New high score!",
    missed: "Game over. Continue?",
    invite: "Enter your initials",
    glyph: "■",
  },
  "plot-twist": {
    waiting: "Something's coming…",
    locked: "Locked. Or is it? (It is.)",
    won: "Didn't see that coming.",
    missed: "Twist: you were wrong.",
    invite: "Expect the unexpected",
    glyph: "?",
  },
  "steal-the-spotlight": {
    waiting: "The spotlight's warming up…",
    locked: "You're in the light. Watch the stage.",
    won: "Spotlight: stolen.",
    missed: "Someone else got the spotlight.",
    invite: "Step into the spotlight",
    glyph: "✧",
  },
  "confetti-department": {
    waiting: "Sweeping up for the next one…",
    locked: "Filed under answered.",
    won: "Department-approved confetti!",
    missed: "Confetti request denied.",
    invite: "Report to the Confetti Department",
    glyph: "✿",
  },

  // Dark and atmospheric
  "midnight-matcha": {
    waiting: "Whisking the next one…",
    locked: "Steeping. Watch the stage.",
    won: "Perfectly brewed.",
    missed: "A little bitter.",
    invite: "Pull up a cushion",
    glyph: "❦",
  },
  "petrol-and-peach": {
    waiting: "Filling up for the next one…",
    locked: "Pump 26. Paid.",
    won: "Full tank of points.",
    missed: "Running on fumes.",
    invite: "Pull in at pump 26",
    glyph: "ϟ",
  },
  ultraviolet: {
    waiting: "Blacklight on. Next one soon.",
    locked: "Glowing in the dark. Watch the stage.",
    won: "You absolutely glowed.",
    missed: "Faded out.",
    invite: "Step under the blacklight",
    glyph: "◈",
  },

  // Light and nostalgic
  "pistachio-party": {
    waiting: "Cracking open the next one…",
    locked: "In the shell. Watch the stage.",
    won: "Nuts. That's right.",
    missed: "Bit of a dud.",
    invite: "Grab a handful and join",
    glyph: "●",
  },
  "peach-please": {
    waiting: "Peeling the next one…",
    locked: "Peachy. Watch the stage.",
    won: "Just peachy.",
    missed: "Bruised, not broken.",
    invite: "Peach, please",
    glyph: "♡",
  },
  "blue-hour": {
    waiting: "The light's changing…",
    locked: "Caught the light. Watch the stage.",
    won: "Golden. Well, blue.",
    missed: "Missed the light.",
    invite: "Catch the blue hour",
    glyph: "☾",
  },
  "retro-future": {
    waiting: "Rendering the future…",
    locked: "Transmitted to tomorrow.",
    won: "The future is you.",
    missed: "Lost in the timeline.",
    invite: "Board the retro future",
    glyph: "◢",
  },
  "poolside-2000": {
    waiting: "Topping up the sun cream…",
    locked: "Splash. Watch the stage.",
    won: "Making a splash.",
    missed: "Belly flop.",
    invite: "Dive in",
    glyph: "≈",
  },
  "paper-party": {
    waiting: "Cutting out the next one…",
    locked: "Glued down. Watch the stage.",
    won: "Gold star sticker!",
    missed: "Crumpled. Try again.",
    invite: "Grab the scissors and join",
    glyph: "✎",
  },
  "lavender-menace": {
    waiting: "Brewing mischief…",
    locked: "Menace mode: locked.",
    won: "Delightfully menacing.",
    missed: "Too calm for that one.",
    invite: "Join the menace",
    glyph: "✿",
  },

  // Personal to the night
  "humza-studio": {
    waiting: "Setting up the next take…",
    locked: "Take one. Locked.",
    won: "That's the take.",
    missed: "Cut! Again.",
    invite: "Welcome to Humza Studio",
    glyph: "▶",
  },
  "humza-according-to-everyone": {
    waiting: "Everyone's talking…",
    locked: "Noted. Everyone will hear about it.",
    won: "Everyone agrees: correct.",
    missed: "Everyone has opinions.",
    invite: "Tell us what you think",
    glyph: "❝",
  },
  "the-humza-archives": {
    waiting: "Retrieving the next file…",
    locked: "Filed in the archives.",
    won: "Verified by the archives.",
    missed: "Record not found.",
    invite: "Open the archives",
    glyph: "§",
  },
  "21-november": {
    waiting: "Counting down to the next one…",
    locked: "Circled on the calendar.",
    won: "Best night of the year.",
    missed: "Still a great night.",
    invite: "It's the 21st. Join in",
    glyph: "✶",
  },

  // Persona
  "persona-1-origins": {
    waiting: "Gazing into the next mirror…",
    locked: "Your persona answers.",
    won: "Thou art correct.",
    missed: "The mirror cracked.",
    invite: "Summon your persona",
    glyph: "✧",
  },
  "persona-2-innocent-birthday": {
    waiting: "A rumour is spreading…",
    locked: "The rumour is now true.",
    won: "Rumour confirmed.",
    missed: "Just a rumour.",
    invite: "Spread the rumour",
    glyph: "✦",
  },
  "persona-3-midnight-hour": {
    waiting: "The clock is about to strike…",
    locked: "Sealed in the hidden hour.",
    won: "Memories of you.",
    missed: "Lost in the hidden hour.",
    invite: "Enter the hidden hour",
    glyph: "☾",
  },
  "persona-3-portable-pink-route": {
    waiting: "Spending time with someone…",
    locked: "Social link: answer saved.",
    won: "Rank up!",
    missed: "Maybe next time.",
    invite: "Choose the pink route",
    glyph: "♡",
  },
  "persona-4-golden-hour": {
    waiting: "Rainy night. Check the TV…",
    locked: "Reaching for the truth.",
    won: "Truth found.",
    missed: "Lost in the fog.",
    invite: "Tune in at midnight",
    glyph: "▶",
  },
  "persona-5-take-your-time": {
    waiting: "Take your time…",
    locked: "Calling card sent.",
    won: "Heart stolen!",
    missed: "The treasure slipped away.",
    invite: "Join the phantom thieves",
    glyph: "★",
  },
  "the-velvet-room": {
    waiting: "Welcome back. Please wait…",
    locked: "Your fate is sealed.",
    won: "The cards favour you.",
    missed: "Reversed position.",
    invite: "Welcome to the Velvet Room",
    glyph: "♢",
  },
  "cafe-leblanc": {
    waiting: "Brewing curry and coffee…",
    locked: "Served. Watch the stage.",
    won: "Perfect blend.",
    missed: "Burnt the beans.",
    invite: "Take a seat at the café",
    glyph: "◉",
  },

  // Games
  "final-fantasy-crystal-prelude": {
    waiting: "The prelude plays…",
    locked: "Your will is sealed in crystal.",
    won: "Victory fanfare!",
    missed: "The crystal dims.",
    invite: "Begin the prelude",
    glyph: "◇",
  },
  "final-fantasy-vii-mako": {
    waiting: "Mako reactor charging…",
    locked: "Materia equipped.",
    won: "Limit break!",
    missed: "Out of MP.",
    invite: "Board the train to the reactor",
    glyph: "◉",
  },
  "pokemon-pallet-town": {
    waiting: "A wild question is about to appear…",
    locked: "Gotcha! Answer caught.",
    won: "It's super effective!",
    missed: "It's not very effective…",
    invite: "Start your journey",
    glyph: "◓",
  },
  "pokemon-gengar-hours": {
    waiting: "Something's lurking…",
    locked: "Shadow move locked in.",
    won: "Spooky good.",
    missed: "It vanished…",
    invite: "Stay out past midnight",
    glyph: "✖",
  },
  "smash-final-destination": {
    waiting: "Next stage loading…",
    locked: "Ready!",
    won: "GAME!",
    missed: "Knocked off the stage.",
    invite: "Choose your fighter",
    glyph: "✚",
  },
  "scarlet-nexus-brain-drive": {
    waiting: "Brain drive charging…",
    locked: "Brain field: locked.",
    won: "Psychokinesis hit!",
    missed: "Brain field collapsed.",
    invite: "Link your brain",
    glyph: "⬢",
  },
  "gta-vi-vice-birthday": {
    waiting: "Mission loading…",
    locked: "Mission accepted.",
    won: "Mission passed. Respect up.",
    missed: "Wasted.",
    invite: "Welcome to Vice",
    glyph: "$",
  },
  "ps2-memory-card": {
    waiting: "Loading. Do not remove the memory card…",
    locked: "Saved to memory card (8MB).",
    won: "Save complete. Points too.",
    missed: "Load failed.",
    invite: "Press start",
    glyph: "△",
  },

  // Anime
  "dragon-ball-birthday-saiyan": {
    waiting: "Powering up…",
    locked: "Energy blast locked in!",
    won: "Power level: off the scale!",
    missed: "Need more training.",
    invite: "Power up and join",
    glyph: "ϟ",
  },
  "dragon-ball-capsule-corp": {
    waiting: "Popping the next capsule…",
    locked: "Stored in capsule 26.",
    won: "Engineering genius.",
    missed: "Capsule malfunction.",
    invite: "Visit Capsule Corp",
    glyph: "◍",
  },
  "my-hero-academia-plus-ultra": {
    waiting: "Training for the next round…",
    locked: "Going beyond!",
    won: "Hero-level answer!",
    missed: "Back to training.",
    invite: "Enrol at the academy",
    glyph: "✚",
  },
  "naruto-hidden-leaf": {
    waiting: "Gathering chakra…",
    locked: "Jutsu sealed.",
    won: "Ninja-level answer!",
    missed: "Back to the academy.",
    invite: "Join the Hidden Leaf",
    glyph: "❦",
  },
  "bunny-girl-senpai-after-school": {
    waiting: "Can you still see me?",
    locked: "Noticed. Watch the stage.",
    won: "Seen and remembered.",
    missed: "Lost in the syndrome.",
    invite: "Stay after school",
    glyph: "✿",
  },
  "tsukigakirei-moonlit-walk": {
    waiting: "Walking home under the moon…",
    locked: "Sent. Hoping for a reply.",
    won: "The moon is beautiful tonight.",
    missed: "Left on read.",
    invite: "Walk with me",
    glyph: "☾",
  },
  "your-name-twilight-thread": {
    waiting: "Twilight is coming…",
    locked: "Tied with the red thread.",
    won: "Found you.",
    missed: "The name is fading…",
    invite: "Look up at the comet",
    glyph: "✧",
  },
  "fullmetal-alchemist-equivalent-exchange": {
    waiting: "Drawing the circle…",
    locked: "Equivalent exchange: done.",
    won: "Transmutation complete.",
    missed: "Rebound!",
    invite: "Seek the stone",
    glyph: "△",
  },
  "keijo-absolutely-necessary": {
    waiting: "Stay on the platform…",
    locked: "Absolutely necessary answer.",
    won: "Victory splash!",
    missed: "Into the water!",
    invite: "Step onto the platform",
    glyph: "!",
  },

  // Everyday
  "chinese-takeaway-at-humzas": {
    waiting: "Your order is being prepared…",
    locked: "Order number 26 confirmed.",
    won: "Lucky number!",
    missed: "Wrong order.",
    invite: "Order at Humza's",
    glyph: "№",
  },
  "tea-obviously": {
    waiting: "Kettle's on…",
    locked: "Milk in after. Watch the stage.",
    won: "Proper brew.",
    missed: "Stewed.",
    invite: "Put the kettle on",
    glyph: "◒",
  },
  "rum-and-coke": {
    waiting: "Topping up the ice…",
    locked: "On the rocks. Watch the stage.",
    won: "Cheers!",
    missed: "Went flat.",
    invite: "Pull up a stool",
    glyph: "◎",
  },
  "usual-table-laptop-open": {
    waiting: "Refreshing the tab…",
    locked: "Saved. Ctrl+S.",
    won: "Shipped it.",
    missed: "Merge conflict.",
    invite: "Grab your usual table",
    glyph: "⌘",
  },

  // Cars
  "nissan-leaf": {
    waiting: "Charging…",
    locked: "Fully charged answer.",
    won: "Zero emissions, full points.",
    missed: "Range anxiety.",
    invite: "Plug in and join",
    glyph: "ϟ",
  },
  "toyota-prius-plus": {
    waiting: "Hybrid mode engaged…",
    locked: "Regenerative braking: answer saved.",
    won: "Seven seats of points.",
    missed: "Stalled. Somehow.",
    invite: "Climb into the Prius+",
    glyph: "✚",
  },

  // School
  "wallington-grammar-school-arc": {
    waiting: "Turn to the next page…",
    locked: "Handed in.",
    won: "Gold star.",
    missed: "See me after class.",
    invite: "Take your seat",
    glyph: "✓",
  },
  "greenshaw-next-chapter": {
    waiting: "Next chapter loading…",
    locked: "Answer on the board.",
    won: "Top of the class.",
    missed: "Rubbed out.",
    invite: "Start the next chapter",
    glyph: "✎",
  },
  "portsmouth-student-save-file": {
    waiting: "Saving progress…",
    locked: "Progress saved.",
    won: "Level up: graduate.",
    missed: "Resit required.",
    invite: "Load your save file",
    glyph: "▣",
  },

  // Work
  "amazon-out-for-delivery": {
    waiting: "Out for delivery…",
    locked: "Delivered. Left with a neighbour.",
    won: "Arriving: points.",
    missed: "Sorry we missed you.",
    invite: "Track your answer",
    glyph: "➜",
  },
  "mchumza-birthday-meal": {
    waiting: "Flipping the next one…",
    locked: "Order up!",
    won: "Happy meal, happy points.",
    missed: "The ice cream machine's broken.",
    invite: "Order at the counter",
    glyph: "★",
  },
  "spoon-world-portsmouth-edition": {
    waiting: "Pint's being pulled…",
    locked: "Ordered on the app. Watch the stage.",
    won: "The round's on you.",
    missed: "Sticky table.",
    invite: "Find a table",
    glyph: "◈",
  },
  "fratton-park-matchday-shift": {
    waiting: "Half-time. Back shortly…",
    locked: "On the team sheet.",
    won: "GOAL!",
    missed: "Offside.",
    invite: "Clock in for matchday",
    glyph: "●",
  },
  "stamford-bridge-on-the-clock": {
    waiting: "Clocking back on…",
    locked: "Shift logged.",
    won: "Back of the net.",
    missed: "Off target.",
    invite: "Clock in at the Bridge",
    glyph: "◆",
  },
  "goodwood-all-access": {
    waiting: "Lights out soon…",
    locked: "Lap time logged.",
    won: "Chequered flag!",
    missed: "Pit stop.",
    invite: "Pick up your pass",
    glyph: "⚑",
  },
  "queens-centre-court": {
    waiting: "Quiet, please…",
    locked: "In.",
    won: "Game, set, points.",
    missed: "Out!",
    invite: "Take your seat on centre court",
    glyph: "●",
  },
  "twickenham-under-the-floodlights": {
    waiting: "The scrum is setting…",
    locked: "Try scored. Conversion pending.",
    won: "Over the posts!",
    missed: "Knock-on.",
    invite: "Kick off at Twickenham",
    glyph: "✚",
  },
  "corestream-risk-accepted": {
    waiting: "Circling back shortly…",
    locked: "Risk accepted.",
    won: "Exceeds expectations.",
    missed: "Flagged for review.",
    invite: "Join the stand-up",
    glyph: "✓",
  },
  "501-fun-maximum-fun": {
    waiting: "Chalking the board…",
    locked: "Double top!",
    won: "One hundred and eighty!",
    missed: "Bust.",
    invite: "Step up to the oche",
    glyph: "◎",
  },

  // Musicians
  "pitbull-mr-worldwide": {
    waiting: "Going worldwide…",
    locked: "Mr Worldwide approves.",
    won: "Dale!",
    missed: "Not worldwide yet.",
    invite: "Go worldwide",
    glyph: "✺",
  },
  "bbno-birthday-budget": {
    waiting: "checking the budget…",
    locked: "paid in full.",
    won: "money money money.",
    missed: "insufficient funds.",
    invite: "join on a budget",
    glyph: "$",
  },
  "yung-gravy-gravy-boat": {
    waiting: "Pouring the gravy…",
    locked: "Smooth. Very smooth.",
    won: "Gravy train!",
    missed: "Lumpy.",
    invite: "Climb aboard the gravy boat",
    glyph: "♡",
  },
  "rick-astley-never-gonna-log-you-out": {
    waiting: "Rolling the next one…",
    locked: "Answer rolled. Watch the stage.",
    won: "Up, not down. Points.",
    missed: "Let down.",
    invite: "Get rolled into the quiz",
    glyph: "♪",
  },
};

/** The active theme's voice. */
export function useThemeVoice(): Voice {
  return voices[useThemeId()];
}
