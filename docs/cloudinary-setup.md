# Cloudinary Setup for Schedule Media

The schedule builder now uploads step media (images, videos, audio clips) and optional background music to Cloudinary. Follow these steps to configure your own Cloudinary account locally and in production builds.

## 1. Create or Reuse a Cloudinary Account
1. Visit [https://cloudinary.com/](https://cloudinary.com/) and create a free account (the free tier is sufficient for development).
2. From the dashboard note your **Cloud name**.

## 2. Configure an Unsigned Upload Preset
1. In the Cloudinary console, open **Settings → Upload**.
2. Scroll to **Upload presets** and click **Add upload preset**.
3. Name the preset (for example `cyclefit_unsigned`).
4. Set **Signing mode** to **Unsigned**.
5. Under **Upload control**, enable the resource types you plan to use (at minimum `Image`, `Video`, and `Raw` for audio files). Leave the defaults for transformation.
6. Save the preset and copy the **Upload preset name**.

> Using an unsigned preset keeps your Firebase API keys out of the client while still allowing uploads directly from the app.

## 3. Expose Environment Variables to Expo
The app reads two public variables at build time:

- `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET`

For local development with `expo start`, create an `.env` file in the project root:

```ini
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset
```

Expo automatically loads variables prefixed with `EXPO_PUBLIC_` and makes them available in the app at runtime. Restart the dev server after adding or changing values.

If you prefer to avoid environment files, you can also add the values to `expo.extra` inside `app.json`/`app.config.*`, matching the same keys.

## 4. (Optional) Lock Down Upload Sources
Unsigned presets accept uploads from any client. To limit abuse:

- Add an **Upload restriction** on the preset (e.g., allowed formats, max file size).
- Rotate the preset periodically if it leaks.
- Use signed uploads if you later build a lightweight upload proxy.

## 5. Verify the Flow
1. Run `expo start` and open the mobile app.
2. Create or edit a schedule, attach media to a step, and optionally add background music.
3. Confirm the files appear in your Cloudinary media library.

If uploads fail, check:

- The environment variables are set and match your Cloudinary dashboard values.
- The preset is unsigned and allows the resource types you’re uploading.
- The device has network access.

With these steps completed, the new schedule builder will save Cloudinary URLs in Firestore for playback during workouts.
