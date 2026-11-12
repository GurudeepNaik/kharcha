"use client";

import { useEffect, useState } from "react";
import { APP_NAME } from "@/lib/brand";
import { useI18n } from "@/lib/i18n";
import { installWay, onInstallChange, promptInstall, startInstallWatch, type InstallWay } from "@/lib/install";

/** Header button: "Install" where the browser offers it, Add to Home Screen steps on iPhone, nothing once installed. */
export function InstallButton() {
  const { t } = useI18n();
  const [way, setWay] = useState<InstallWay>("none");
  const [steps, setSteps] = useState(false);

  useEffect(() => {
    startInstallWatch();
    setWay(installWay());
    return onInstallChange(() => setWay(installWay()));
  }, []);

  if (way === "none" || way === "installed") return null;
  return (
    <>
      <button type="button" aria-expanded={way === "ios" ? steps : undefined} aria-controls={way === "ios" ? "ios-steps" : undefined}
        onClick={() => (way === "ios" ? setSteps(s => !s) : void promptInstall())}
        className="press flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-sm font-semibold">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
        {t.install.button}
      </button>
      {way === "ios" && steps && (
        <div id="ios-steps" role="dialog" aria-label={t.install.title(APP_NAME)}
          className="fixed inset-x-3 top-[calc(4.25rem+env(safe-area-inset-top))] z-50 mx-auto max-w-sm rounded-2xl border border-line bg-card p-4 shadow-xl">
          <ol className="list-decimal space-y-1.5 ps-5 text-[15px]">
            <li>{t.install.s1} <ShareGlyph /></li>
            <li>{t.install.s2}</li>
            <li>{t.install.s3(APP_NAME)}</li>
          </ol>
          <button type="button" onClick={() => setSteps(false)} className="press mt-3 min-h-11 w-full rounded-xl bg-soft text-sm font-semibold">{t.install.ok}</button>
        </div>
      )}
    </>
  );
}

function ShareGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Share" role="img" className="inline align-[-2px]">
      <path d="M12 3v12M8 7l4-4 4 4M6 11v9h12v-9" />
    </svg>
  );
}
