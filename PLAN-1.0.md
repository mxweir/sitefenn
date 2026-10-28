# Website Audit Hub – Plan bis 1.0

Stand: 28. Oktober 2026. Arbeitstitel, Name und Markenrechte noch ungeprüft. Dies ist ein Produkt- und Umsetzungsplan, keine bereits implementierte Software.

## 1. Produktentscheidung

Ein lokaler Hub für Menschen, die mehrere Websites entwickeln oder betreuen. Er verbindet beobachtbare Browser-Prüfungen mit verständlichen lokalen KI-Erklärungen, einem priorisierten Arbeitsplan und nachvollziehbaren Wiederholungstests.

**Kernversprechen: Jede wichtige Aufgabe hat eine Fundstelle, einen Nachweis und ein Abnahmekriterium.**

Der Hub beantwortet fünf Fragen:

1. Welche meiner Websites braucht Aufmerksamkeit?
2. Was funktioniert auf Desktop, Tablet und Mobil nicht richtig?
3. Welche Befunde sind bestätigt, welche nur Vermutungen?
4. Was soll ich in welcher Reihenfolge ändern?
5. Ist es nach der Änderung tatsächlich besser geworden?

Die lokale KI ist ein erklärender Analyst, kein autonomer Administrator. Regeln messen, KI erklärt und schlägt vor, Menschen entscheiden. Ein eigener LLM-Trainingslauf ist keine Voraussetzung für 1.0.

## 2. Zwölf Fachperspektiven

Die zwölf Rollen wurden in drei virtuellen Arbeitsgruppen konsultiert. Es handelt sich nicht um zwölf real beauftragte Fachpersonen oder eine unabhängige Zertifizierung.

| Rolle | Verantwortungsbereich und zentrale Entscheidung |
| --- | --- |
| 1. Produktmanager | Ein Hub mit geschlossenem Ablauf: Projekt → Scan → Befund → Aufgabe → Nachtest. |
| 2. UX-/Interaction-Designer | Eine klare nächste Aktion; Live-Befunde dürfen den Arbeitsbereich nicht überladen. |
| 3. Frontend-/Visualisierungsarchitekt | Prüf-Browser als Bildstream mit separaten, koordinatentreuen Overlays darstellen. |
| 4. Open-Source-/Marketing-Lead | Belegbare Ergebnisse und echter Demo-Modus statt „KI findet alles“-Werbung. |
| 5. Browser-Automation-Engineer | Kontrollierte Seiten- und Zustandsprüfung statt wahllosem autonomen Durchklicken. |
| 6. Backend-/Datenarchitekt | Dauerhafte Scan-Jobs, unveränderliche Nachweise, versionierte Regeln und vergleichbare Läufe. |
| 7. Security-/Privacy-Engineer | Browser isolieren, lokale API schützen, private Ziele nur ausdrücklich freigeben. |
| 8. Local-LLM-/ML-Engineer | Kleine beleggebundene Anfragen, strukturierte Ausgabe, kein Training ohne Daten und Evaluation. |
| 9. Technical-SEO-/Search-Console-Spezialist | Technische Prüfbarkeit und tatsächliche Google-Sichtbarkeit getrennt anzeigen. |
| 10. Accessibility-Engineer | Automatische Befunde von manuellen Prüfpunkten und unvollständigen Ergebnissen trennen. |
| 11. QA-/Performance-Engineer | Bekannte Fehlerseiten, saubere Negativfälle und getrennte Performance-Läufe. |
| 12. Scoring-/Evaluation-Spezialist | Deterministische Scores mit Abdeckung und Versionsbindung, keine KI-Note. |

## 3. Zielgruppe und Grenzen

Primär: Solo-Webentwickler, Freelancer und kleine Teams mit einigen betreuten Websites. Zunächst ein lokaler Benutzer und öffentliche oder ausdrücklich freigegebene Entwicklungsseiten.

Nicht Teil von 1.0: Agentur-Mandantenportal, Mehrbenutzerrechte, Cloud-Synchronisation, Penetrationstests, vollständige rechtliche Prüfung, automatisches Ändern fremder Websites, Backlink-Datenbank, universelles Keyword-Ranking oder vollständiger Screenreader-/Usability-Test.

Das Produkt ist eigenständige Software, nutzt aber etablierte Prüfbibliotheken. Sein Mehrwert ist deren nachvollziehbare Verbindung mit Belegen, Aufgaben und Nachtests. Markt-Einzigartigkeit wird nicht behauptet; dafür wäre eine gesonderte Wettbewerbsprüfung nötig.

## 4. Der Hub

### Projektübersicht

Jede Website bekommt eine Projektkarte mit Name, Umgebung (Produktion/Staging/lokal), Domain, letztem Scan, Prüfprofil, bestätigten kritischen Befunden, Audit-Score samt Abdeckung und einem vergleichbaren Trend.

Ein Projekt speichert:

- Start-URL, erlaubte Hosts und ausgeschlossene Pfade.
- Gewählte Seiten, wichtige Einstiegsseiten und maximale Crawltiefe.
- Geräte-/Viewport-Profil, Sprache, Zeitzone und definierte Consent-Situation.
- Optional freigegebene harmlose Interaktionsschritte.
- Scan-Verlauf, Aufgaben, bewusst akzeptierte Risiken und Evidenz.
- Optional importierte Search-Console-Daten; diese bleiben vom Audit-Score getrennt.

### Navigation

**Projekte · Prüfungen · Aufgaben · Sichtbarkeit · Einstellungen**

Innerhalb eines Projekts: **Übersicht · Live-Check · Befunde · Maßnahmenplan · Vergleich**. Kein Chat als Hauptnavigation. Eine konkrete „Befund erklären“-Aktion kann direkt am Problem sitzen.

### Erstnutzung

1. Abhängigkeiten und lokale Modellverbindung prüfen.
2. Beispielprojekt mit absichtlich eingebauten Fehlern ausprobieren, auch ohne Modell.
3. Eigene Website hinzufügen und Berechtigung sowie Zielbereich bestätigen.
4. Scan-Profil und tatsächlich zu prüfende Seiten auswählen.
5. Scan beobachten, Report öffnen und einen ersten Plan exportieren.

Fehlendes Ollama blockiert keinen regelbasierten Scan. Die Anwendung erklärt, was ohne Modell verfügbar ist und wie ein ausdrücklich gewähltes Modell eingerichtet wird. Keine überraschenden Downloads mehrerer Gigabyte.

## 5. On-Screen-Check

### Viewports

Standardprofil als versionierter Entwurf:

| Profil | Viewport in CSS-Pixeln | Eingabemodus |
| --- | --- | --- |
| Desktop | 1440 × 900 | Maus/Tastatur |
| Tablet | 768 × 1024 | Touch-Emulation |
| Mobil | 390 × 844 | Touch-Emulation |

Das sind Browserprofile, keine Garantie für alle realen Geräte. DPR, User Agent, Touch-Einstellungen und Ausrichtung gehören zur gespeicherten Konfiguration. In 1.0 wird Chromium verwendet; Safari-/Firefox-Kompatibilität ist damit nicht zertifiziert.

Eigene Viewports sind möglich, erzeugen aber ein anderes Vergleichsprofil. Kleine zusätzliche Grenzbreiten können später gezielt ergänzt werden; kein unbegrenztes Breitenraster im Erstumfang.

### Kontrollierter Scan-Ablauf

**Seiten entdecken → Auswahl bestätigen → Browser öffnen → Seite stabilisieren → scrollen/prüfen → erlaubte Zustände prüfen → Nachweise speichern → nächster Viewport → Report abschließen.**

Standard: bis zehn ausgewählte Seiten, maximal dreißig je Scan als anfängliche Schutzgrenze, drei Viewports, begrenzte Schritte und Zeit je Seite. Das sind Produktlimits, keine Zusage einer bestimmten Scandauer.

Crawling dedupliziert URLs, entfernt Fragmente und behandelt Query-Parameter mit projektbezogenen Regeln. Keine pauschale Entfernung semantisch relevanter Parameter. Sitemaps helfen bei der Entdeckung, sind aber keine automatische Freigabe für beliebige Hosts. Crawl-Abdeckung und Ausschlüsse werden dokumentiert.

Fonts, Bilder und relevante Seitenelemente erhalten begrenzte Bereitschaftsprüfungen. Endloses Warten auf „kein Netzwerkverkehr“ ist keine robuste allgemeine Strategie. Animationen und dynamische Inhalte werden soweit möglich kontrolliert; Eingriffe stehen im Report.

### Was automatisch geprüft wird

| Bereich | Erstumfang | Grenzen |
| --- | --- | --- |
| Responsive/Layout | Horizontales Überlaufen, abgeschnittene Inhalte, verdächtige Überdeckungen, unerreichbare zentrale Bedienelemente | Bounding-Box-Überlappung allein ist kein Fehlerbeweis. |
| Funktion/Technik | Dokumentstatus, defekte interne Links, fehlgeschlagene eigene Ressourcen, Browserfehler | Ein Konsolenfehler ist nicht automatisch ein kritischer Funktionsausfall. |
| Accessibility | axe-core-Regeln, zugängliche Namen, bestimmte Kontraste, zusätzliche begrenzte Fokusprüfungen | Keine vollständige WCAG-Konformitätsaussage. |
| Technisches SEO | Title/Description, Canonical, Robots-Angaben, grundlegende Verlinkung, Kontext der Überschriften, grundlegende strukturierte Daten | Kein Google-Indexierungsbeweis und keine Ranking-Garantie. |
| Performance | Lokale Lighthouse-Labormessung auf wenigen gewählten Referenzseiten | Keine Gleichsetzung mit realem Nutzerverhalten. |
| UX/visuelle Qualität | Begründete lokale Modellvorschläge zu Hierarchie, Lesbarkeit und Orientierung | Empfehlungen, kein objektiver Geschmacks- oder Conversion-Score. |

SEO-Regeln berücksichtigen Projektabsicht: Ein beabsichtigtes `noindex` auf Staging ist nicht derselbe Fehler wie ein versehentliches `noindex` auf einer zu indexierenden Produktseite. Mehrere H1 oder eine bestimmte Meta-Description-Länge werden nicht pauschal als kritische Ranking-Verstöße behauptet.

### Interaktionen sicher begrenzen

Standardmäßig Navigation und Scrollen, keine beliebigen KI-Klicks. Ausklappmenüs und Akkordeons nur über ausdrücklich konfigurierte, geprüfte Schritte. Keine Bestellungen, Nachrichten, Formulareinreichungen, Zustimmungs-Klicks, Datei-Uploads, Downloads oder Löschaktionen.

Die Live-Ansicht ist in 1.0 beobachtend: Pause, Stop und Befundauswahl, kein allgemeiner Fernsteuerungsbrowser. Auch Seitenbesuche können durch fremdes JavaScript oder schlecht entworfene GET-Endpunkte Auswirkungen haben. „Beabsichtigt nicht mutierend“ ist ehrlicher als eine Garantie vollständiger Wirkungslosigkeit.

## 6. Live-Ansicht mit direkten Markierungen

Links läuft der aktuelle Prüf-Browser, rechts erscheinen Ereignisse und bestätigte Befunde. Oben stehen URL, Viewport, Schritt, Phase und Fortschritt in erledigten/geplanten Prüfschritten. Kein erfundener Gesamtprozentsatz, solange die Seitenliste noch wächst.

Technisch wird der Browser separat ausgeführt. Seine Frames werden als gedrosselter Bildstream in die Oberfläche übertragen. Die fremde Website wird nicht als aktiver Inhalt in den Hub eingebettet. Websites können Einbettung über `frame-ancestors` einschränken; der Stream vermeidet zudem eine unnötige Vertrauensvermischung. [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors)

Eine gepinnte Playwright-Version wird auf geeignete Screencast-Unterstützung geprüft. Periodische Screenshots sind der verpflichtende Fallback. Playwright dokumentiert eine Frame-basierte Screencast-Schnittstelle; deren tatsächliche Verfügbarkeit wird gegen die ausgelieferte Version getestet. [Playwright](https://playwright.dev/docs/api/class-screencast)

- Markierungen werden im Hub über das Bild gezeichnet, nicht in die gemessene Seite eingefügt.
- Jeder Befund referenziert Frame, URL, Viewport, Scrollposition, Zustand und Elementgeometrie.
- Ein eingefrorener Nachweis wird nicht als aktueller Live-Frame ausgegeben.
- Rot = bestätigter schwerer Befund, Orange = bestätigter weiterer Befund, separat gekennzeichnet = Prüfkandidat. Farbe allein reicht nicht als Kennzeichnung.
- Befunde erscheinen zunächst als Messereignisse. KI-Erklärungen dürfen später dazukommen; „vorläufig“ und „abgeschlossen“ sind sichtbar.
- Performance läuft separat ohne Stream und Modellinferenz, damit unsere Vorschau die Messung nicht unnötig belastet.

## 7. Befunde und Prioritäten

Jeder Befund enthält:

`ID · Regelversion · Kategorie · URL · Viewport/Zustand · Elementanker · Messwert · Nachweis · Schwere · Erkenntnisstatus · Erklärung · Maßnahme · Abnahmetest`

Erkenntnisstatus: **gemessen/bestätigt · heuristischer Kandidat · KI-Empfehlung · manuell bestätigt · nicht prüfbar**. Ein modellgenerierter Prozentsatz ist kein kalibrierter Sicherheitsnachweis.

| Priorität | Bedeutung | Beispiel |
| --- | --- | --- |
| Kritisch | Nachgewiesener erheblicher Blocker im definierten Nutzungskontext | Hauptaktion auf Mobil durch ein Element nicht erreichbar. |
| Wichtig | Relevante Einschränkung ohne vollständigen Blocker | Bestätigter Kontrastfehler oder defekter wichtiger interner Link. |
| Nice to have | Nicht blockierende Verbesserung oder begründete Gestaltungsempfehlung | Präzisere CTA-Beschriftung als UX-Vorschlag. |

Nicht jeder Title-Fehler wird kritisch, nicht jede fehlende Meta Description kostet Ranking. Wirkung, Reichweite und Kontext bestimmen die Arbeitsreihenfolge. Vermutungen werden nicht allein durch dramatische Formulierung kritisch.

Gemeinsame Komponentenfehler werden zu Aufgaben gebündelt: ein Headerproblem auf zwölf Seiten ergibt eine Hauptaufgabe mit zwölf Fundstellen statt zwölf identischer Tickets. Die Rohbefunde bleiben erhalten.

## 8. Maßnahmenplan, Checkliste und Markdown

Der Plan sortiert zunächst Blocker, dann breite Komponentenprobleme, danach weitere wichtige Aufgaben und optionale Verbesserungen. Aufwand ist eine grobe, explizit unsichere Einstufung, keine garantierte Stundenangabe. Abhängigkeiten werden angezeigt.

Aufgabenstatus: **Offen · In Arbeit · Zur Prüfung · Verifiziert behoben · Akzeptiertes Risiko**. Ein manuelles Abhaken setzt nur „Zur Prüfung“. Erst ein passender Nachtest bestätigt die Behebung. Ein verschwundener Selektor allein ist kein Beweis: Seite oder Zustand könnten nicht mehr geprüft worden sein.

### Exportbeispiel

```markdown
# Maßnahmenplan – Beispielprojekt
Scan: scan-123 | Profil: responsive-v1 | Regeln: rules-v1
Geprüfter Bereich: /, /angebote, /kontakt

- [ ] AUD-014 – Mobilnavigation verdeckt die Hauptaktion
  - Priorität: Kritisch
  - Status: gemessen/bestätigt
  - Fundstelle: /angebote, 390×844, Zustand menu-open
  - Beleg: evidence/AUD-014.png
  - Beobachtung: Der Hit-Test trifft das Menü statt des sichtbaren Buttons.
  - Vermutete Ursache: Menü-/Overlay-Zustand bleibt aktiv.
  - Aufgabe: Zustandswechsel und Fokusführung im Quellprojekt prüfen.
  - Abnahme: Menü öffnen/schließen; Hauptaktion per Touch und Tastatur erreichen.
  - Grenzen: Kein Quellcode angebunden; keine verifizierte Datei-/Zeilenangabe.
```

Ein Markdown-Bericht ist allein verständlich. Ein optionales ZIP enthält Markdown, JSON und relative Evidenzdateien, damit Belege beim Weitergeben nicht verloren gehen. „Für andere KI kopieren“ enthält nur ausgewählte, bereinigte Befunde und klare Arbeitsgrenzen.

Exportierte Website-Texte sind nicht vertrauenswürdig und können Anweisungen enthalten. Inhalte werden als Daten gekennzeichnet und minimiert. Kein Export fordert eine andere KI pauschal zu beliebiger Befehlsausführung, Datenübertragung oder unkontrollierter automatischer Reparatur auf.

## 9. Score von 0 bis 100

Der Wert heißt **Audit-Score für den geprüften Umfang**, nicht Website-Gesamtnote oder Google-Score. Er ist deterministisch, versioniert und unabhängig von Modellwahl und Formulierung.

Vorgeschlagene feste Kategoriengewichte für Profil v1:

| Kategorie | Gewicht |
| --- | ---: |
| Responsive/Layout | 25 % |
| Automatisiert prüfbare Accessibility | 20 % |
| Technisches SEO | 25 % |
| Funktion/Technik | 15 % |
| Performance auf definierten Referenzseiten | 15 % |

Gewichte und Regelrelevanz werden an Testfällen kalibriert und vor 1.0 eingefroren. Subjektive UX-Vorschläge und Google-Sichtbarkeit verändern diesen Score nicht. Bekannte kritische Blocker werden unabhängig vom Durchschnitt prominent angezeigt.

### Berechnung und fehlende Ergebnisse

Jede vorab geplante anwendbare Regelinstanz hat ein festes Gewicht. Zustände: PASS, FAIL, NOT_RUN oder begründetes NOT_APPLICABLE. PASS zählt 1, FAIL 0. Fehlende Messung ist unbekannt, niemals automatisch bestanden.

Für eine Kategorie mit anwendbarem Gesamtgewicht D, bestandenem Gewicht P und unbekanntem Gewicht U:

- Untergrenze = `100 × P / D`
- Obergrenze = `100 × (P + U) / D`
- Abdeckung = `(D − U) / D`

Vollständig geprüft bedeutet U = 0; dann gibt es einen festen Kategorienwert. D = 0 ergibt N/A, nicht 100. Pflichtkategorien ohne anwendbare/ausgeführte Messungen verhindern einen finalen Gesamtwert.

Beispiel: **„68–82/100, vorläufig; 86 % Prüfgewicht ausgewertet“** statt einer erfundenen eindeutigen 78. Für diese Beispielwerte können P=68, U=14, D=100 gelten. Gewichtet werden anschließend die Kategoriengrenzen mit den festen Profilgewichten.

NOT_APPLICABLE ist nur durch die Anwendbarkeitsregel begründbar. Ein Fehler kann nicht per „ignorieren“ zu N/A werden. Akzeptierte Risiken bleiben im objektiven Ergebnis sichtbar. Ausgeschlossene Seiten stehen außerhalb des deklarierten Umfangs; der Score repräsentiert dann ausdrücklich nicht die gesamte Domain.

Performance bekommt vorab definierte Laborkonfiguration, Referenzseiten und versionierte Auswertung. Für das obige binäre Modell werden ausdrücklich dokumentierte Metrik-Schwellen als Regeln verwendet; native Lighthouse-Rohscores und Messwerte bleiben separat sichtbar. Einzelne Lighthouse-Empfehlungen werden nicht zusätzlich als beliebige Doppelabzüge verrechnet. Tablet ist ein Layoutprofil, nicht automatisch ein eigenständiges validiertes Lighthouse-Gerätescoring. Ein 100er-Audit ist keine vollständige Barrierefreiheit, SEO-Erfolgsgarantie oder Aussage über ungeprüfte Seiten.

## 10. Entwicklung zwischen zwei Tests

Ein Vergleich zeigt **neu · weiterhin vorhanden · verifiziert behoben · wieder aufgetreten · nicht erneut geprüft** sowie Vorher-/Nachher-Nachweise.

Vergleichsschlüssel: normalisierte URL, Regel-ID/-Version, stabiler Komponenten-/Elementanker, Viewport und Zustand. Unsichere Zuordnungen werden nicht stillschweigend als Lösung ausgegeben.

Echte Score-Deltas erfordern gleiche Regeln, Gewichte, Seiten-/Zustandsmenge, Browser-/Messprofile und vergleichbare Bedingungen. Bei veränderter Seitenmenge gibt es einen Vergleich der gemeinsamen Teilmenge und einen separaten erweiterten Scan, nicht „+12 Punkte“ durch Weglassen schwieriger Seiten.

Regelupdates verändern alte Berichte nicht rückwirkend. Eine optionale Neuberechnung aus kompatiblen Rohdaten wird als solche markiert. Laufzeit- und Lighthouse-Schwankungen bleiben erkennbar; für vertiefte Performance-Tests drei serielle Wiederholungen mit Median und Streuung vorsehen. Lighthouse beschreibt ausdrücklich Schwankungen durch unterschiedliche Messbedingungen. [Chrome-Dokumentation](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring)

## 11. Google-Sichtbarkeit statt erfundenem Rang

Es gibt nicht den einen festen Google-Rang einer Website. Search Console liefert unter anderem Klicks, Impressionen, CTR und durchschnittliche Position, filterbar etwa nach Suchanfrage, Seite, Land und Gerät. Ergebnisse können je nach Nutzerkontext unterschiedlich ausfallen. [Google Search Console](https://support.google.com/webmasters/answer/7576553?hl=en)

### 1.0-Pflichtumfang: Search-Console-Import

Ein explizit dokumentierter CSV-Import unterstützt ausgewählte Search-Console-Exporte einschließlich Zeitraum, Dimensionen, Filtern, Herkunft und Importdatum. Nicht enthaltene Filter werden abgefragt oder als unbekannt markiert. Tages-, Seiten- und Suchanfragentabellen werden nicht zu erfundenen Kombinationen zusammengefügt.

Anzeigen:

- Klicks, Impressionen, CTR und durchschnittliche Position.
- Gewinner-/Verliererseiten in vergleichbaren Zeiträumen.
- Suchanfragen mit vielen Impressionen und geringer CTR als Untersuchungsansatz, nicht automatische Ursache.
- Getrennte Geräte-/Länderansichten, soweit die Daten sie tatsächlich enthalten.
- Sichtbarer Stand und Warnung bei unvollständigen/neuesten Daten.

Aggregierte CTR wird aus Klicks/Impressionen berechnet, nicht als ungewichteter Mittelwert einzelner CTRs. Durchschnittspositionen werden nur mit passender, dokumentierter Aggregation zusammengeführt; sonst getrennt angezeigt. Aus fehlenden Zeilen wird nicht automatisch „Platz 0“ oder „kein Traffic“.

### Optionale 1.0-Erweiterung: Read-only OAuth

Direkte Verbindung zur eigenen berechtigten Property, minimaler Read-only-Scope, widerrufbare Verbindung und geschützte Tokens. Eigene Google-Client-Konfiguration kann erforderlich sein; öffentlich verteilte OAuth-Zugänge haben einen gesonderten Setup-/Freigabeaufwand. Der Release hängt deshalb nicht daran.

Die Search-Analytics-API garantiert nicht sämtliche Datenzeilen; fehlende oder anonymisierte Anfragen werden nicht rekonstruiert. Finalisierte und vorläufige Daten bleiben unterscheidbar. Datumsgrenzen der API beziehen sich auf Pacific Time; der Hub verschiebt sie nicht stillschweigend auf Berliner Kalendertage. [Google API](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)

### Nicht in 1.0

Kein Google-SERP-Scraping, kein universelles Live-Keyword-Ranking für fremde Domains und keine behauptete Ranking-Ursache durch einen einzelnen Fix. Ein späterer SERP-Dienst wäre ein freiwilliger externer Anbieter mit Kosten und Standort-/Gerätebezug.

CrUX-Felddaten können später oder optional ergänzen, sofern vorhanden. Nicht jede URL erfüllt die Aufnahmebedingungen; fehlende Felddaten bedeuten nicht schlechte Performance. Labormessungen, Felddaten und Suchsichtbarkeit werden getrennt dargestellt. [CrUX-Methodik](https://developer.chrome.com/docs/crux/methodology)

## 12. Lokale KI auf dem M5 Pro mit 24 GB

Start mit einem quantisierten Modell der Klasse ungefähr 7–9 Milliarden Parameter als Benchmark-Kandidat, nicht als bereits bewiesene optimale Auswahl. Visuelle Analyse ist ein optionaler gesonderter Kandidat; nicht jedes Textmodell versteht Screenshots.

- Ein Modell und eine Modellanfrage zur Zeit.
- Browserseiten begrenzt seriell prüfen; keine drei parallelen Geräte-Browser plus mehrere Modelle.
- Relevante Belege/Ausschnitte statt kompletter unbereinigter HTML-Seiten senden.
- Kontext und Bildmenge begrenzen, Warteschlange und Abbruch anbieten.
- Keine Modellinferenz während kontrollierter Performance-Messungen.
- Modell, Quantisierung, Kontext, Prompt und Ausgabeversion protokollieren.
- Modelllizenz prüfen; keine ungeklärte Gewichtsverteilung im Repository.

Ollama liefert strukturierte Ausgaben per Schema. Dieses wird zusätzlich validiert; korrektes JSON garantiert keine richtigen Aussagen. Unbekannte Evidence-IDs, erfundene URLs und nicht belegte Dateipfade werden verworfen. [Ollama](https://docs.ollama.com/capabilities/structured-outputs)

Die lokale KI darf erklären, Aufgaben bündeln und als solche markierte UX-Hypothesen formulieren. Sie hat keinen Shell-, Schreib-, Token-, Geräte- oder autonomen Browserzugriff. Verifizierte Regelbefunde und Score bleiben ohne sie verwendbar.

Training erst nach belegtem Bedarf: kuratierte Beispiele mit menschlicher Bewertung, separates unbekanntes Testset, Lizenzprüfung und messbarer Vorteil gegenüber Prompt/Referenzen. Kein Fine-Tuning als Marketingdekoration.

## 13. Technischer Aufbau

| Schicht | Vorschlag |
| --- | --- |
| Oberfläche | React, TypeScript, Vite; lokale Web-App, keine Streamlit-Oberfläche. |
| API/Orchestrierung | Node.js LTS und Fastify; Schema-Validierung. |
| Scan-Worker | Eigener Prozess mit gepinntem Playwright/Chromium. |
| Prüfwerkzeuge | axe-core, Lighthouse, eigene kleine versionierte Layout-/SEO-Regeln. |
| Live-Ereignisse | SSE für Status/Befunde; WebSocket oder abgegrenzter Frame-Endpunkt für Vorschau. |
| Daten | SQLite mit Migrationen; Evidenzdateien im eigenen App-Datenverzeichnis. |
| Modell | Ollama-Adapter mit lokalem Endpoint und validierten Schemas. |
| Export | Markdown, JSON und optionales Evidenz-ZIP. |

Zunächst natives lokales Startpaket auf macOS, damit Browser und Ollama nicht unnötig durch unterschiedliche Container-Netzwerke getrennt werden. Abhängigkeiten sind gesperrt und reproduzierbar installierbar. Ein Desktop-Wrapper oder Docker-Paket kann später folgen; keine Paketvielfalt vor funktionierendem Kern.

### Datenmodell

Project → ScanProfile → ScanRun → PageRun/StateRun → RuleResult → Finding → Evidence.

Task referenziert ein oder mehrere Findings; Vergleich referenziert zwei unveränderte ScanRuns. SearchDataset bleibt separat und enthält Herkunft/Zeitraum/Filter. ReportGenerations speichern Modell-/Promptversion und sind kein Ersatz für Rohdaten.

Jobs: queued, running, pausing/paused, completed, failed, cancelled, interrupted. Nach vollem App-Neustart bleiben erledigte Nachweise erhalten; angefangene Seitenschritte werden ausdrücklich als unterbrochen markiert und bei Wiederaufnahme sauber neu ausgeführt. Kein vorgetäuschtes exaktes Fortsetzen einer verlorenen Browsersitzung.

Artefakte haben Speicherbudget, Aufbewahrungsregeln, Export und gezieltes Löschen. Keine dauerhafte Videoaufzeichnung sämtlicher Sessions als Standard.

## 14. Sicherheit und Datenschutz als Release-Bedingung

- Lokale API standardmäßig nur Loopback, nicht unbemerkt im Heimnetz.
- Session-Authentisierung, Host-/Origin-Prüfung, restriktives CORS und CSRF-Schutz; auch WebSocket-Upgrades prüfen. Localhost allein ist keine Zugangskontrolle.
- Nur HTTP(S), keine beliebigen Datei-/Spezialprotokolle. Zielvalidierung bei Redirects und Verbindungen, IPv4/IPv6 und DNS-Wechsel berücksichtigen.
- Private Netze standardmäßig gesperrt. Lokale Entwicklungsziele nur als ausdrücklich freigegebener Host/Port; keine pauschale Freigabe aller LAN-Adressen.
- Subressourcen ebenfalls auf verbotene/private Ziele prüfen; notwendige öffentliche CDN-Ressourcen bedeuten nicht, dass deren Domains als Crawlziele freigegeben sind.
- Playwright-Request-Routing allein ist keine ausreichende Netzwerk-Sicherheitsgrenze. Vor einem allgemein freigegebenen Scanmodus ist eine überprüfte Egress-Abschirmung etwa über einen kontrollierten Proxy bzw. geeignete Prozess-/Netzwerkisolation erforderlich, einschließlich WebSockets, Service Workern und DNS-Auflösung. Ist das auf einer Plattform noch nicht verlässlich umgesetzt, bleibt der Modus ausdrücklich auf vertrauenswürdige eigene Ziele begrenzt und wird nicht als sicherer Scanner beliebiger Websites veröffentlicht.
- Browserprozess ohne persönliche Browserprofile oder unnötige Betriebssystemberechtigungen; Sandbox nicht blind abschalten.
- Fremdes HTML nie ungefiltert als Hub-HTML rendern. Vorschau zeigt Bilddaten, Berichte rendern bereinigten Text.
- Cookie-/Tokenwerte, Autorisierungsheader und sensible Formularwerte nicht in Modellkontext oder Standardexport übernehmen.
- Seiten können trotzdem personenbezogene Daten in Screenshots enthalten. Speicherung, Löschung und freiwilliger Export müssen klar sein; spätere Schwärzung nicht als schon vorhanden behaupten.
- Website-Inhalt als untrusted behandeln: Prompt Injection darf keine Regeln, Prioritäten, Tools oder Datenziele umschreiben.
- Keine automatische Cloud-Ausweichlösung, wenn das lokale Modell fehlt.
- Search Console und andere externe Verbindungen sind freiwillige Netzwerkfunktionen. Ein Webscan selbst kontaktiert selbstverständlich die Website.

Authentisierte Bereiche, Session-Import und allgemeine Fernsteuerung werden aus 1.0 herausgehalten. Ihre Unterstützung benötigt ein eigenes Sicherheitskonzept.

## 15. Roadmap bis 1.0

Versionen sind Lieferpakete, keine Kalenderwochen. Jeder Schritt hat einen prüfbaren Ausgang und kann bei Qualitätsproblemen überarbeitet werden.

| Version | Lieferpaket | Abnahmekriterium |
| --- | --- | --- |
| **0.1 – Fundament** | Lokaler Start, Dependency-Check, Projekte, SQLite, Beispielwebsite, Scan-Jobs | Ein Projekt und ein einfacher Scan überstehen App-Neustart; Daten liegen nicht im Git-Checkout. |
| **0.2 – Crawler** | Host-/Pfadgrenzen, Sitemap-/Linkentdeckung, Seitenauswahl, Status-/Ressourcenfehler, Limits | Kontrollierter Scan ohne Verlassen des Zielbereichs; Abbrüche und Schleifenfälle getestet. |
| **0.3 – Responsive Engine** | Drei Viewports, Geometrie/Hit-Tests, erste Layoutregeln, axe-core, Screenshots | Absichtlich defekte UND korrekt überlappende Beispiele werden sinnvoll unterschieden. |
| **0.4 – Live Workspace** | Browserbild, Fortschrittsereignisse, synchronisierte Overlays, Pause/Stop, Screenshot-Fallback | Ein angeklickter Befund zeigt exakt seinen eingefrorenen Nachweis; keine Markierungsdrifts. |
| **0.5 – Reports und Aufgaben** | Kategorien, Prioritäten, Komponenten-Deduplikation, Checkliste, Markdown/JSON/ZIP | Jede bestätigte Aufgabe hat Beleg und Abnahme; Export funktioniert ohne laufenden Hub. |
| **0.6 – Lokale KI** | Ollama-Setup, beleggebundene Erklärungen, strukturierter Plan, optionale Bildanalyse | Modell-Ausfall blockiert keine Messung; erfundene Evidence-IDs und Prompt-Injection-Tests werden abgefangen. |
| **0.7 – Score und Verlauf** | Versionierte Scoring-Regeln, Abdeckung, Referenz-Performance, Befund-Lebenszyklus, Vergleich | Gleiche Rohdaten ergeben identische Werte; fehlende Ergebnisse verbessern keinen Score. |
| **0.8 – Sichtbarkeit** | Dokumentierter GSC-CSV-Import, Zeitvergleich, Seiten-/Query-Ansichten; OAuth optional | Filter/Zeiträume transparent; keine falschen Summen oder erfundenen Rankingwerte. |
| **0.9 – Release Candidate** | Sicherheitshärtung, reale Websites, UX-/Accessibility-Prüfung, Backup, Ressourcenmessung | Pflicht-Testmatrix grün, bekannte Grenzen dokumentiert, keine offenen kritischen Produktfehler. |
| **1.0 – Öffentlicher Release** | Reproduzierbare Installation, Demo, echte Screens/GIFs, Dokumentation, Lizenzen und getaggtes Release | Alle nachstehenden Freigabekriterien erfüllt; keine versteckte Pflicht-Cloud. |

### Was den Release nicht blockieren soll

Read-only Google OAuth, CrUX-Anbindung, Desktop-Wrapper, Scheduler, GitHub-Issue-Push und Quellcode-Verknüpfung sind Erweiterungen. Der Kernnutzen steht ohne sie. Ein durchgehender Google-CSV-Import ist dagegen Bestandteil des geplanten 1.0-Sichtbarkeitsmoduls.

## 16. Test- und Qualitätsplan

### Kontrollierte Referenzseiten

Mindestens zwanzig kleine Fixtures für defekte und saubere Zustände: abgeschnittener Text, horizontales Overflow, erlaubtes Overlay, verdeckter CTA, Sticky Header, transformierte Elemente, Lazy Loading, Bildfehler, Fontwechsel, Dialog, Shadow DOM und bewusst nicht prüfbare Frames. Fälle ohne sichere Erkennung werden als Grenze dokumentiert.

Dazu technische SEO-, Accessibility-, Redirect-, Fehlerstatus- und Crawl-Schleifenfälle. Pro Regel: Anwendbarkeit, Positivfall, Negativfall und erklärbare Ausgabe. Kein „alles bestanden“, nur weil ein Selektor nichts gefunden hat.

### Messbare Ziele vor 1.0

- Für die zunächst unterstützten schweren Layoutfehler auf einem getrennten, manuell beschrifteten Testset Zielpräzision mindestens 95 %. Testmenge und Fehlalarme werden veröffentlicht; die Kennzahl ist keine Aussage über alle Websites.
- Recall ebenfalls messen und offenlegen: Eine niedrige Fehlalarmrate durch fast keine Erkennung ist kein Erfolg.
- Score aus identischen gespeicherten Inputs exakt reproduzierbar.
- Kein nachweisloser Befund als „gemessen“; KI-Empfehlungen sichtbar getrennt.
- Exportprüfung: alle referenzierten Artefakte enthalten oder ausdrücklich extern/fehlend markiert.
- Unterbrochene Jobs, beschädigte Artefakte, DB-Migrationen, Speicherknappheit, doppeltes Event und Modellfehler testen.
- SSRF-/DNS-Rebinding-/Redirect-, Origin-/CSRF-, XSS- und Prompt-Injection-Tests in den Freigabeprozess nehmen.
- Scan und Live-UI auf dem angegebenen M5-Pro-/24-GB-Gerät messen: Peak-Speicher, Dauer, Modellkonfiguration und Live-Latenz berichten. Ohne Messung keine Sekunden- oder RAM-Garantie.
- Hub selbst per Tastatur, mit reduziertem Bewegungseffekt und mindestens einem Screenreader durchgängig benutzbar machen.

Automatische Accessibility-Befunde sind keine vollständige Prüfung; axe unterscheidet beispielsweise eindeutige Probleme von Fällen mit weiterem Prüfbedarf. [Deque](https://docs.deque.com/devtools-for-web/4/en/devtools-scanning/)

### Pilot

Fünf bis acht Webentwickler mit ausdrücklich freigegebenen Projekten: Website hinzufügen, Fehler finden, Aufgabe exportieren, Fix vornehmen und nachtesten. Erfolg ist ein nachvollziehbarer behobener Befund, nicht nur eine hübsche Scorekarte. Pilot-Zahlen sind qualitative Produktprüfung, keine repräsentative Wirksamkeitsstudie.

## 17. 1.0-Freigabe und Dokumentation

Pflicht: Vollständiger Ablauf funktioniert ohne Modell und mit unterstütztem lokalem Modell; alle drei Viewports; direkte Live-Nachweise; priorisierte Aufgaben; portabler Export; fairer Vergleich; klar begrenzter Score; GSC-Import; sichere lokale Installation und erprobte Datenwiederherstellung.

README: echter Nutzen, tatsächlicher Scan-GIF, Grenzen, Hardware-/Modellhinweise, Installationsweg, Berechtigungen, Datenverzeichnis, Netzwerkverhalten, Export, Score-Erklärung und Beispielreport.

Repository: geeignete Code-Lizenz nach Dependency-Prüfung, Lockfile, Security Policy, CONTRIBUTING, Issue-Vorlagen, Changelog, Test-Fixtures und dokumentierte Datenformate. Modellgewichte nicht ungeprüft mitliefern. Reports niemals standardmäßig mit echten Kundendaten als Demo veröffentlichen.

Jedes Update dokumentiert neue Regeln, geänderte Scoreversionen, Migrationen, Fixes und gegebenenfalls neue echte Screens. Keine stillen Änderungen an historischen Berichten.

## 18. Priorisierte Erweiterungen nach 1.0

1. **Release-Gate/CI:** einen festen Scan per CLI starten und neue bestätigte Blocker melden.
2. **Geplante Nachtests:** mit bewusst aktivierter Ausführung und Mitteilung nur relevanter Veränderungen.
3. **Quellcode-Anbindung:** Belege zu Komponenten und verifizierten Dateien zuordnen; Patchvorschläge nur zur Prüfung.
4. **Google Read-only OAuth und CrUX:** falls nicht bereits optional geliefert, mit sauberem Credential-/Quota-Verhalten.
5. **Weitere Browser und reale Geräte:** Unterschiede erkennen statt Browseremulation als universelle Wahrheit auszugeben.
6. **Freigegebene Nutzerabläufe:** kontrollierte Tests in Staging mit eigener Sicherheits- und Testdatenstrategie.

Nicht alles vorziehen: Ohne verlässliche Erkennung, sinnvolle Aufgaben und faire Nachtests wird ein Hub nur eine weitere Dashboard-Sammlung.

## 19. Startempfehlung

Zuerst 0.1–0.3 als vertikalen Kern entwickeln: **ein Projekt, drei Viewports, wenige verlässliche Regeln und belastbare Nachweise**. Danach Live-Ansicht und Aufgabenfluss, dann lokale KI. Damit entsteht früh überprüfbarer Nutzen und die KI muss keine fehlende Prüftechnik verdecken.

Die Entwicklung selbst ist mit diesem Plan noch nicht gestartet; es wurden weder ein neues GitHub-Repository noch ein Release erstellt.
