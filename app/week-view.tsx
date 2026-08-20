"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { todayInHelsinki } from "@/lib/dates";
import {
  expectedMonday,
  pruneStore,
  readWeek,
  storeWeek,
} from "@/lib/store";
import type { WeekData } from "@/lib/types";
import { DayList } from "./components/day-list";
import { DayStrip } from "./components/day-strip";
import { ErrorState, Skeleton, StaleBanner } from "./components/states";
import { WeekNav } from "./components/week-nav";

type Status = "ready" | "loading" | "error";

export function WeekView({
  initialData,
  serverToday,
}: {
  initialData: WeekData | null;
  serverToday: string;
}) {
  // Palvelimen laskema päivä ensirenderöintiin, jotta hydraatio täsmää.
  // Selain laskee sen uudelleen heti kiinnittymisen jälkeen.
  const [today, setToday] = useState(serverToday);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<WeekData | null>(initialData);
  const [status, setStatus] = useState<Status>(initialData ? "ready" : "loading");
  const [staleAt, setStaleAt] = useState<number | null>(null);

  const requestId = useRef(0);
  const loadedAt = useRef(initialData ? Date.now() : 0);
  const scrolledFor = useRef<string | null>(null);

  // silent = älä näytä latausluurankoa. Taustapäivitys ei saa tyhjentää ruutua.
  const load = useCallback(
    async (nextOffset: number, { silent = false } = {}) => {
      const myId = ++requestId.current;
      const saved = readWeek(expectedMonday(nextOffset));

      // Tallennettu lista ruudulle heti; verkko korjaa sen perässä.
      if (saved) {
        setData(saved.data);
        setStatus("ready");
        setStaleAt(null);
      } else if (!silent) {
        setStaleAt(null);
        setStatus("loading");
      }

      try {
        const res = await fetch(`/api/week?offset=${nextOffset}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(String(res.status));
        const fresh = (await res.json()) as WeekData & { error?: string };
        if (fresh.error) throw new Error(fresh.error);
        if (myId !== requestId.current) return; // käyttäjä ehti vaihtaa viikkoa

        storeWeek(fresh);
        setData(fresh);
        setStatus("ready");
        setStaleAt(null);
        loadedAt.current = Date.now();
      } catch {
        if (myId !== requestId.current) return;
        if (saved) {
          setStaleAt(saved.savedAt);
        } else {
          setStaleAt(null);
          setStatus("error");
        }
      }
    },
    [],
  );

  useEffect(() => {
    pruneStore();
    setToday(todayInHelsinki());

    // Palvelimen renderöimä sivu voi tulla service workerin välimuistista ja
    // sisältää edellisen viikon listan. Siihen luotetaan vain jos se osuu
    // kuluvaan viikkoon — muuten haetaan kuten ilman alkudataa.
    if (initialData && initialData.start === expectedMonday(0)) return;
    void load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Välilehti voi olla auki yön yli — päivitä kun siihen palataan.
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && Date.now() - loadedAt.current > 10 * 60 * 1000) {
        setToday(todayInHelsinki());
        void load(offset, { silent: true });
      }
    };
    // Kotivalikosta avatussa sovelluksessa ei ole selaimen päivityspainiketta,
    // joten yhteyden palatessa lista haetaan itsestään.
    const onOnline = () => void load(offset, { silent: true });

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [load, offset]);

  // Avaa kuluva päivä näkyviin kerran viikkonäkymää kohden — ei joka
  // taustapäivityksellä, jottei sivu nykisi kesken lukemisen.
  useEffect(() => {
    if (!data || status !== "ready") return;
    if (data.start !== expectedMonday(0)) return;
    if (scrolledFor.current === data.start) return;
    scrolledFor.current = data.start;

    const el = document.querySelector<HTMLElement>(".day.today");
    if (el && el.getBoundingClientRect().bottom > window.innerHeight) {
      el.scrollIntoView({ block: "center", behavior: "instant" });
    }
  }, [data, status]);

  const go = (delta: number) => {
    const next = offset + delta;
    setOffset(next);
    void load(next);
  };

  const scrollToDay = (date: string) => {
    const el = document.getElementById(`d-${date}`);
    // Tarkoituksella "instant": osassa selaimista pehmeä vieritys on kytketty
    // pois, jolloin smooth-pyyntö ei tee mitään ja painike jäisi kuolleeksi.
    if (el) el.scrollIntoView({ block: "center", behavior: "instant" });
  };

  return (
    <>
      <WeekNav data={data} onPrev={() => go(-1)} onNext={() => go(1)} />
      {data && (
        <DayStrip days={data.days} today={today} onSelect={scrollToDay} />
      )}
      <StaleBanner savedAt={staleAt} />

      <main id="days">
        {status === "loading" && <Skeleton />}
        {status === "error" && <ErrorState onRetry={() => void load(offset)} />}
        {status === "ready" && data && <DayList data={data} today={today} />}
      </main>
    </>
  );
}
