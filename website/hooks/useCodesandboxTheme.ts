import { useEffect } from "react";
import { subscribe, snapshot } from "valtio";
import { themeState } from "~/state";

export const useCodesandboxTheme = () => {
  useEffect(() => {
    updateCodesandboxEmbeds();
    return subscribe(themeState, updateCodesandboxEmbeds);
  }, []);

  const updateCodesandboxEmbeds = () => {
    const isDarkMode = snapshot(themeState).isDarkMode;
    const codesandboxEmbeds = document.querySelectorAll(
      '[src*="codesandbox.io/embed"]'
    );
    codesandboxEmbeds.forEach((embed) => {
      const frame = embed as HTMLIFrameElement;
      const url = new URL(frame.src);
      const currentCodesandboxTheme = url.searchParams.get("theme");
      const newCodesandboxTheme = isDarkMode ? "dark" : "light";
      if (currentCodesandboxTheme === newCodesandboxTheme) return;
      url.searchParams.set("theme", newCodesandboxTheme);
      frame.src = url.toString();
    });
  };
};
