import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

export type ThemePreference = "system" | "light" | "dark";

type SettingsContextType = {
  themePreference: ThemePreference;
  setThemePreference: (t: ThemePreference) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (v: boolean) => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  isLoaded: boolean;
};

// --------------------------------------------------
// STORAGE KEYS
// --------------------------------------------------

const KEY_THEME = "@settings/theme";
const KEY_NOTIFICATIONS = "@settings/notifications";
const KEY_SOUND = "@settings/sound";

// --------------------------------------------------
// CONTEXT
// --------------------------------------------------

export const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

// --------------------------------------------------
// PROVIDER
// --------------------------------------------------

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [themePreference, setThemePreferenceState] =
    useState<ThemePreference>("system");
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load persisted settings on mount
  useEffect(() => {
    (async () => {
      try {
        const [theme, notifs, sound] = await AsyncStorage.multiGet([
          KEY_THEME,
          KEY_NOTIFICATIONS,
          KEY_SOUND,
        ]);

        if (theme[1]) {
          setThemePreferenceState(theme[1] as ThemePreference);
        }
        if (notifs[1] !== null) {
          setNotificationsEnabledState(notifs[1] === "true");
        }
        if (sound[1] !== null) {
          setSoundEnabledState(sound[1] === "true");
        }
      } catch (e) {
        // AsyncStorage failure — fall back to defaults silently
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const setThemePreference = async (t: ThemePreference) => {
    setThemePreferenceState(t);
    await AsyncStorage.setItem(KEY_THEME, t).catch(() => {});
  };

  const setNotificationsEnabled = async (v: boolean) => {
    setNotificationsEnabledState(v);
    await AsyncStorage.setItem(KEY_NOTIFICATIONS, String(v)).catch(() => {});
  };

  const setSoundEnabled = async (v: boolean) => {
    setSoundEnabledState(v);
    await AsyncStorage.setItem(KEY_SOUND, String(v)).catch(() => {});
  };

  return (
    <SettingsContext.Provider
      value={{
        themePreference,
        setThemePreference,
        notificationsEnabled,
        setNotificationsEnabled,
        soundEnabled,
        setSoundEnabled,
        isLoaded,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

// --------------------------------------------------
// HOOK
// --------------------------------------------------

export const useSettings = (): SettingsContextType => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
};
