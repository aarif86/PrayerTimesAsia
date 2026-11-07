#!/usr/bin/env python3
"""
The prayer alarm tones (Gentle chime, Rising bells, Soft beeps, and Classic for
the web), made from plain sine waves so there is nothing to license.

    python3 tools/make_alarm_sounds.py      # writes chime.wav, bells.wav, beeps.wav, classic.wav here
    then, for each NAME (needs ffmpeg):
      ffmpeg -i NAME.wav -ac 1 -ar 22050 -c:a adpcm_ima_qt -f caf ios/PrayerTimesAsia/Resources/alarm-NAME.caf
      ffmpeg -i NAME.wav -c:a libvorbis -q:a 3 android/app/src/main/res/raw/alarm_NAME.ogg
      ffmpeg -i NAME.wav -t 8 -c:a libmp3lame -b:a 64k web/src/assets/alarm/NAME.mp3   (the web loops it)

28 seconds each: iOS plays at most 30 seconds of a notification sound.
On the phones, Classic is the phone's own alarm sound.
"""
import numpy as np, wave
SR=44100; DUR=28.0
def out(name, x):
    x = x / max(1e-9, np.max(np.abs(x))) * 0.85
    # fade out the last 0.5 s, fade in 10 ms
    n=len(x); f=int(0.5*SR); x[-f:]*=np.linspace(1,0,f); x[:441]*=np.linspace(0,1,441)
    with wave.open(name+'.wav','wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x*32767).astype(np.int16).tobytes())
N=int(SR*DUR); t=np.arange(N)/SR
def bell(f, dur, decay, partials=((1,1),(2.0,.5),(2.76,.3),(5.4,.12))):
    tt=np.arange(int(dur*SR))/SR
    s=sum(a*np.sin(2*np.pi*f*r*tt)*np.exp(-tt*decay*(1+r*.3)) for r,a in partials)
    a=np.minimum(1,tt/0.005); return s*a
def add(buf, sig, at):
    i=int(at*SR); j=min(len(buf), i+len(sig)); buf[i:j]+=sig[:j-i]
# Gentle chime: soft pentatonic phrase every 4 s
x=np.zeros(N); notes=[659.25,783.99,880.0,1046.5,880.0]
for k,start in enumerate(np.arange(0,DUR-2,4.0)):
    for i,f in enumerate(notes[:4] if k%2==0 else notes[1:]):
        add(x, 0.6*bell(f,2.5,2.2,((1,1),(2,.25),(3,.08))), start+i*0.45)
out('chime', x)
# Rising bells: a bell pair every 1.5 s, getting louder over 20 s
x=np.zeros(N)
for start in np.arange(0,DUR-1.5,1.5):
    add(x, bell(1318.5,1.4,3.0), start); add(x, bell(987.77,1.4,3.0), start+0.35)
x*=np.minimum(1, 0.12+0.88*t/20)
out('bells', x)
# Soft beeps: two rounded beeps every 1.2 s
x=np.zeros(N)
def beep(f, d):
    tt=np.arange(int(d*SR))/SR; env=np.sin(np.pi*tt/d)**2
    return np.sin(2*np.pi*f*tt)*env + 0.15*np.sin(2*np.pi*2*f*tt)*env
for start in np.arange(0,DUR-1.2,1.2):
    add(x, beep(880,0.16), start); add(x, beep(880,0.16), start+0.25)
out('beeps', x)
# Classic (web only; phones use their own alarm sound): four fast beeps then a pause
x=np.zeros(N)
def sq(f,d):
    tt=np.arange(int(d*SR))/SR; s=np.sign(np.sin(2*np.pi*f*tt))*0.5+np.sin(2*np.pi*f*tt)*0.5
    env=np.minimum(1,np.minimum(tt,d-tt)/0.004); return s*env
for start in np.arange(0,DUR-1,1.0):
    for i in range(4): add(x, sq(1046.5,0.07), start+i*0.12)
out('classic', x)
