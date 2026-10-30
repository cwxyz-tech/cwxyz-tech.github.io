COLE'S GAMES for Mac
====================
Blackjack DX, Lines DX and Lucky Flip as a real Mac app for Apple silicon (M1 and newer).
The games are built in, so it works offline, and your chips, coins and high scores save on your Mac.


BUILD IT (one time, about a minute)
-----------------------------------
1. Unzip this folder somewhere, like your Desktop.
2. Open Terminal (press Cmd+Space, type Terminal, press Return).
3. Type "cd " (with a space), drag the ColesGames folder into the Terminal window, and press Return.
4. Run:
       ./build.sh
   (If it says "permission denied", run "bash build.sh" instead.)
   If it says the Command Line Tools aren't installed, run "xcode-select --install", click Install,
   wait for it to finish, and run ./build.sh again. (They're free from Apple; you don't need all of Xcode.)
5. A Finder window opens with "Cole's Games.app". Drag it into your Applications folder. Done!


PLAYING
-------
The toolbar switches between Home, the three games and Music. Each game scales to fill the window at
the right shape (resize the window or go full screen and it follows), and runs at your screen's refresh rate.
Games menu:   Home  Cmd+0    Blackjack DX  Cmd+1    Lines DX  Cmd+2    Lucky Flip  Cmd+3    Music  Cmd+4
              Restart Game  Cmd+R
View menu:    Full screen  Ctrl+Cmd+F
The Music section plays every song from the games, with Repeat One to loop a song.
The secret Konami code still works.


GIVING IT TO A FRIEND
---------------------
The app is signed just for your Mac. If you send it to someone, the first time they open it they'll need to
right-click it, choose Open, then click Open again (or go to System Settings > Privacy & Security > Open Anyway).
To skip that, you'd sign it with a paid Apple Developer account and have Apple notarize it.


UPDATING THE GAMES
------------------
When you change the games on your website, rebuild the app's copy from your website folder, then build again:
       python3 tools/update_games.py /path/to/cwxyz-tech.github.io Resources/www
       ./build.sh


WHAT'S INSIDE
-------------
Sources/main.swift     The app: a native AppKit window with a Mac toolbar, menus and full screen, showing the
                       games with Apple's WebKit. It serves the games from memory inside the app, fits each
                       game to the window, and opens any web links in your browser instead.
Resources/www          The launcher, the three games, the music player, songs and fonts.
Resources/AppIcon.icns The 8-bit playing cards icon.
Info.plist             The app's name, version and settings.
build.sh               Builds and signs "Cole's Games.app".
