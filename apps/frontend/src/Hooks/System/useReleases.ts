import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { currentLanguage } from "../../i18n";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { errorMessage, type ReleaseList } from "./types";

/** All releases, newest first. `refresh` forces a fetch of the tags. */
export const useReleases = () => {
  const [list, setList] = useState<ReleaseList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // State changes only in the callbacks, so the effect can call it.
  const load = (refresh: boolean) =>
    http
      .get<ReleaseList>(End_Points.System_Releases_Endpoint(), {
        params: { lang: currentLanguage(), ...(refresh ? { refresh: 1 } : {}) },
        withCredentials: true,
      })
      .then((response) => {
        setList(response.data);
        setError('');
      })
      .catch((error: unknown) => setError(errorMessage(error)))
      .finally(() => setLoading(false));

  const fetchReleases = async (refresh = false) => {
    setLoading(true);
    await load(refresh);
  };

  // Notes come in the UI language: when the language changes, fetch again.
  const { i18n } = useTranslation();
  useEffect(() => {
    void load(false);
  }, [i18n.language]);

  return { list, loading, error, fetchReleases };
};
