import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

function getLocalStorageKey(userId: string) {
  return `sipsaver-saved-venues-${userId}`;
}

function readLocalSavedVenues(userId: string) {
  const raw = window.localStorage.getItem(getLocalStorageKey(userId));

  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function writeLocalSavedVenues(userId: string, venueIds: string[]) {
  window.localStorage.setItem(getLocalStorageKey(userId), JSON.stringify(venueIds));
}

export function useSavedVenues() {
  const { user } = useAuth();
  const [savedVenueIds, setSavedVenueIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [storageMode, setStorageMode] = useState<"supabase" | "local" | "none">("none");

  useEffect(() => {
    let isActive = true;

    async function loadSavedVenues() {
      if (!user) {
        if (isActive) {
          setSavedVenueIds([]);
          setStorageMode("none");
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);

      if (isSupabaseConfigured && supabase && !user.id.startsWith("local-")) {
        const { data, error } = await supabase
          .from("saved_venues")
          .select("venue_id")
          .eq("profile_id", user.id);

        if (!error && isActive) {
          setSavedVenueIds((data ?? []).map((entry) => entry.venue_id as string));
          setStorageMode("supabase");
          setIsLoading(false);
          return;
        }
      }

      if (isActive) {
        setSavedVenueIds(readLocalSavedVenues(user.id));
        setStorageMode("local");
        setIsLoading(false);
      }
    }

    void loadSavedVenues();

    return () => {
      isActive = false;
    };
  }, [user]);

  async function toggleSavedVenue(venueId: string) {
    if (!user) {
      return;
    }

    const isSaved = savedVenueIds.includes(venueId);
    const nextSavedVenueIds = isSaved
      ? savedVenueIds.filter((id) => id !== venueId)
      : [...savedVenueIds, venueId];

    setSavedVenueIds(nextSavedVenueIds);

    if (isSupabaseConfigured && supabase && !user.id.startsWith("local-")) {
      if (isSaved) {
        const { error } = await supabase
          .from("saved_venues")
          .delete()
          .eq("profile_id", user.id)
          .eq("venue_id", venueId);

        if (!error) {
          setStorageMode("supabase");
          return;
        }
      } else {
        const { error } = await supabase.from("saved_venues").insert({
          profile_id: user.id,
          venue_id: venueId,
        });

        if (!error) {
          setStorageMode("supabase");
          return;
        }
      }
    }

    writeLocalSavedVenues(user.id, nextSavedVenueIds);
    setStorageMode("local");
  }

  return {
    savedVenueIds,
    isLoading,
    isSignedIn: Boolean(user),
    storageMode,
    toggleSavedVenue,
  };
}
