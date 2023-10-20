#!/bin/bash

xset s noblank
xset s off
xset -dpms
DISPLAY=:0 xrandr --output HDMI-1 --rotate normal

unclutter -idle 0.5 -root &

sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' /home/pi/.config/chromium/Default/Preferences
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' /home/pi/.config/chromium/Default/Preferences

/usr/bin/chromium-browser --enable-features=WebContentsForceDark --noerrdialogs --disable-infobars --kiosk http://localhost &


# Temporary fix for chromium issue
while true; do
   xdotool key F5;
   sleep 60
done
