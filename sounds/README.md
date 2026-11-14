# Notification sounds

The game plays these files. **You can replace any of them.**

| File           | When it plays                                        |
|----------------|------------------------------------------------------|
| `bells.wav`    | Half of the scene's time is gone (50%)               |
| `hurry.wav`    | Only 10% of the scene's time is left (hurry up!)     |
| `level-up.wav` | The STOP button is pressed in time ("level cleared") |

## Replacing a sound

- **Easiest:** put your own file here with the **same name** (for example a new `bells.wav`), then reload the page.
- **Different name or format:** copy the file here and change its path in `src/config.js`, under `SOUND.FILES`:

  ```js
  FILES: {
    bells:   'sounds/bells.wav',
    hurry:   'sounds/hurry.wav',
    levelUp: 'sounds/level-up.wav'
  }
  ```

Tips for the old Android 4.4 tablet or phone:

- Use **WAV** or **MP3**. Avoid OGG, OPUS and M4A.
- Keep sounds **short** (under 2 seconds) and small (under ~200 KB).
- If a file is missing or can't be decoded, the game keeps working silently.
- Sound can be switched off on the OPTIONS screen (SOUND ON/OFF), and the volume is `SOUND.VOLUME` in `src/config.js`.
- To try your sounds, open `tools/sound-preview.html`.

## Restoring the defaults

```
python3 tools/make-sounds.py
```

This rewrites the three default files.
