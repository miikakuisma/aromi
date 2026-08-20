export default function Page() {
  return (
    <div className="wrap">
      <header>
        <p className="eyebrow">Kouluruoka</p>
        <h1>Meilahden ala-aste</h1>
      </header>

      <footer>
        <div className="key">
          <span>
            <b className="mark veg">Veg</b> Vegaaninen
          </span>
          <span>
            <b className="mark heart">♥</b> Parempi valinta
          </span>
        </div>
        <p>
          Ruokalista haetaan Helsingin kaupungin Aromi-palvelusta. Tarkat
          allergeeni- ja erityisruokavaliotiedot löydät{" "}
          <a
            href="https://aromi.hel.fi/AromieMenus/FI/Default/PALKE/KeMenu054/"
            target="_blank"
            rel="noopener"
          >
            Aromin omalta sivulta
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
