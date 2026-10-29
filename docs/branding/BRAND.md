# SiteFenn · Brand & Character System

Stand: 29. Oktober 2026. In der Oberfläche umgesetzt. Name weiterhin ohne abschließende Domain-/Markenprüfung. Repository und Paket heißen seit 1.1 `sitefenn`; das bestehende Datenverzeichnis `website-audit-hub` bleibt erhalten. Die Umbenennung löscht oder verschiebt keine Projekte.

## Identität

**SiteFenn** ist das Produkt. **Fenn**, ein aufmerksamer Wüstenfuchs, ist sein Begleiter.

Claim: **„Deine Site. Klarer Blick.“**

Descriptor: **„Dein lokaler Website-Begleiter.“**

Nutzenversprechen: Websites prüfen, Beobachtungen belegen und den nächsten Arbeitsschritt verstehen. Nicht: „KI findet jeden Fehler“ oder „garantiert besseres Google-Ranking“.

## Gewählte Stilrichtung

Auf Nutzerwunsch inspiriert von der [Flying-Papers-Stilreferenz bei Refero](https://styles.refero.design/style/7d254296-6817-487a-a58c-4d5eca89cbf3): violette Grundfläche, kräftige Display-Schrift, flache Farbflächen, schwarze Linien und reduzierter Cartoon. Keine fremden Logos, Charaktere oder kommerziellen Fontdateien werden übernommen.

Die Übertragung auf den Hub ist bewusst funktional: große Schrift im Einstieg, ruhige helle Flächen für Befunde, lesbare Formulare und kompakte Datenansichten. Keine riesigen Posterüberschriften in jeder Befundkarte. Keine Schatten, Glows oder 3D-Illustrationen als neue Markensprache.

## Farben

| Rolle                              | Wert      |
| ---------------------------------- | --------- |
| Bühne / Canvas                     | `#8584BD` |
| Sidebar / Deep violet              | `#3D365C` |
| Lilac                              | `#61609A` |
| Ink / Haupttext und Konturen       | `#1A1A1A` |
| Cream / Karten und primäre Buttons | `#F9F5F2` |
| Lemon / Markenakzent               | `#F4ED36` |
| Butter / warmer Display-Akzent     | `#F9CC73` |
| Pink / aktives Projekt             | `#F8C1BA` |

Helle Display-Schrift auf Violett erhält eine dunkle Kontur. Normaler Text verwendet dunkle Schrift auf Violett oder Cream; auf der dunklen Sidebar helle Schrift. Farbe ersetzt keine Statusbezeichnung. Auf Projektkarten ist Pink eine Auswahlfarbe, kein Fehlerschweregrad.

Geprüfte normale Textpaare: Ink auf Canvas ungefähr 5,00:1, Ink auf Cream 16,05:1, Cream auf Deep violet 10,30:1. Das sind Farbpaarprüfungen, keine vollständige WCAG-Konformitätsprüfung. Die aktuelle Palette ist zusätzlich in `tokens.json` dokumentiert; die Anwendung verwendet die CSS-Tokens.

Primäre Buttons sind cremefarbene Pills mit dunkler Kontur. Karten haben 6-Pixel-Radien; die Formensprache unterscheidet Inhalt und Aktion. Kein ungeprüftes Übertragen kleiner heller Referenztexte auf den Arbeitsbereich.

## Typografie

- **Archivo Black:** Wortmarke und große Einstiegsüberschrift.
- **DM Sans Variable:** Oberfläche, Formulare und Erklärungen.
- **System-Monospace:** kurze technische Labels und Metadaten.

Die beiden Webfonts werden mit gepinnten npm-Paketen lokal gebündelt. Kein Google-Fonts-Netzwerkabruf. SIL-OFL-Lizenzen und Copyright-Hinweise liegen unter `public/licenses/` und werden mit ausgeliefert. Die kommerziellen Schriften aus der Stilreferenz sind nicht Teil der Anwendung.

## Fenn: Gestaltung

Aktueller Master: `public/brand/fenn-flat-v2.png`, 1199 × 1312 Pixel, echter Alpha-Kanal.

Ein cremefarbener Fennek mit großen Ohren, klaren dunklen Augen, gelben Ohrflächen und kleinem gelbem Halsband. Eine erhobene Pfote dient als erklärende Geste. Dicke schwarze Konturen und vereinfachte Formen ersetzen die erste weiche 2.5D-Richtung. Die Figur ist neu generiert, keine Übernahme des Referenzmaskottchens.

Das kleine Signet wird separat als SVG gezeichnet und nicht automatisch aus dem Rasterbild ausgeschnitten. Wortmarke bleibt echter Text. Aktuell: Fenn-Kopf in Navigation und Hinweisen; SVG-Favicon. Kein Animationspaket und keine vorgetäuschte Mundbewegung.

## Verhalten und Sprache

Fenn ist freundlich, aufmerksam und konkret. Keine Druckmechaniken, beschämenden Kommentare oder behauptete Allwissenheit. Beobachtung, vermutete Ursache und Empfehlung bleiben getrennt. Fehlende Prüfungen werden nicht als Erfolg verkauft.

Aktuelle Integration:

- Einklappbarer Begleiter mit lokalen Markenassets und einem klar gekennzeichneten statischen Einstiegstipp.
- Optionale beleggebundene Ollama-Erklärung nach einem abgeschlossenen Check und ausdrücklicher Modellauswahl.
- Kennzeichnung **„Statischer Tipp · keine KI“**, bis tatsächlich eine validierte Modellantwort vorliegt; anschließend Modellname und **„Lokale KI“**.
- Optionale lokale macOS-Sprachausgabe nach Aktivierung und Klick auf Vorlesen; kein Mikrofon und kein Autoplay.

Die Hinweise ändern sich aus tatsächlichem App-Zustand, nicht aus einer simulierten Unterhaltung. Technische Fehlermeldungen und Ergebnisse bleiben ohne Avatar verständlich. Die Figur überdeckt keine Bedienelemente und keinen Screenshot-Nachweis.

Das Modell erhält begrenzte strukturierte Texte, keine Screenshots oder Browsersteuerung. Ungültige Antworten werden als Fehler angezeigt. Keine automatische Cloud-Ausweichlösung. Tatsächliche Modelltests und Grenzen stehen in [Release-Prüfung](../RELEASE-1.0.md).

## Vorlagen für spätere Erklärungen

> „Auf Mobil verdeckt das Menü den Hauptbutton. Hier ist der Nachweis. Prüfe zuerst, ob das Menü korrekt geschlossen wird.“

> „Die Meta Description fehlt. Das ist ein technischer Hinweis, kein Beweis für ein Rankingproblem.“

> „Dieser Zustand wurde nicht erneut geprüft. Die Behebung kann ich deshalb noch nicht bestätigen.“

Nicht verwenden: „Alles perfekt“, „Ich habe die komplette Website geprüft“, „Google wird dich abstrafen“.

## Grenzen und nächste Schritte

Keine Repository-Umbenennung durch die Marke. Die Schema-2-Datenmigration gehört zum Funktionsupdate und bewahrt vorhandene Projekte. Weitere Avatar-Zustände werden später mit derselben Identität erstellt; der einzelne Master ist kein bereits vorhandenes Sprite-/Animationsset.

Vor endgültigem Namens-/Domain-Rollout bleiben Verfügbarkeit und mögliche Verwechslungen separat zu prüfen. Ein KI-generiertes Bild ist kein Nachweis exklusiver Gestaltung oder geklärter Markenrechte.

## Herkunft und Dateien

- `AVATAR-PROMPT.md`: ursprünglicher verworfener 2.5D-Entwurf.
- `AVATAR-FLAT-PROMPT.md`: tatsächlicher Edit-Prompt für den aktuellen flachen Master, eingebauter Bildgenerator.
- `BRAND-PROPOSAL.md` und `tokens.proposed.json`: historische erste Richtung, nicht aktives Theme.
- `web/styles.css`: tatsächlich verwendete Farb- und Typografieregeln.
- `public/brand/`: Avatar und Favicon.
- `public/licenses/`: vollständige Font-Lizenzen.
