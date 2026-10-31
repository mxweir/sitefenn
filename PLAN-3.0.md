# SiteFenn — Verbesserungsplan bis 3.0

Stand: **31. Oktober 2026**. Status: **2.1 implementiert und lokal geprüft; 2.2–3.0 bleiben Plan**, ohne Kalender- oder Release-Zusage. Ausgangspunkt ist Commit `7c54d84f3987f34e1034e3cb823b846732dd4039`. Dessen macOS-/Ubuntu-CI ist inzwischen vollständig erfolgreich.

Grundlage: drei spezialisierte Agentenreviews für Architektur/Betrieb/Security, Produkt/UX/Frontend und KI/QA/SEO, anschließend gemeinsame Priorisierung. Das ist ein tatsächlicher Code-/Artefaktreview durch Softwareagenten, **keine externe Fachpersonen- oder Nutzerstudie**. Für diese Planung wurden keine neuen Modellläufe, Funktionstests oder Kundenscans ausgeführt.

## 3.0 soll eine klare Frage beantworten

**Welche Änderung an meiner Website ist jetzt sinnvoll, worauf beruht sie und hat sie tatsächlich geholfen?**

SiteFenn wird zum täglichen lokalen Arbeitsbereich für Entwickler, Freelancer und kleine Agenturen mit mehreren eigenen oder freigegebenen Websites. Der Kern ist eine nachvollziehbare Reparaturkette: Änderung erkennen → Beleg verstehen → konkrete Arbeit übergeben → Fix nachtesten → Verlauf behalten.

Die bestehende Marke, Fenn und der React-/Fastify-/SQLite-/Playwright-Kern bleiben erhalten. Der nächste große Nutzen kommt aus weniger Kontextwechseln, verlässlicheren Erklärungen und dauerhaft brauchbarer Historie. Ein größeres Modell, zusätzliche Dashboard-Kacheln oder ein neuer Framework-Stack sind dafür kein eigenes Produktziel.

## Was 2.0 bereits trägt — und was der Review gefunden hat

2.0 besitzt echte Befund-/Nachtest-Verifizierung, Quellvorschau, Entwicklerpakete, CLI-Gate, lokale Sicherung und optionale KI. Dokumentiert sind 124 Node- und 20 Browser-Tests; die echten Modellläufe liefern weiterhin sachlich falsche Antworten. Siehe [Releaseprüfung](docs/RELEASE-2.0.md) und [tatsächliche KI-Ausgabe](docs/evaluation/page-run-2.0.json).

| Befund aus dem Review | Beleg im aktuellen Code | Konsequenz |
| --- | --- | --- |
| Referenzschutz kann alte Verifizierungsverweise übersehen | `protectedScans()` in [maintenance.ts](server/services/maintenance.ts) verwendet das global auf 3.000 Aufgaben begrenzte `Store.tasks()` in [store.ts](server/store.ts) | Sicherheitsrelevante Referenzabfragen müssen vollständig sein und dürfen keine UI-Limits erben. |
| Endgültige Löschung ist nicht über Dateisystem und DB absturzsicher | `purgeTrash()` löscht Bilddateien vor den DB-Einträgen | Unterbrechungen können noch vorhandene Papierkorbeinträge mit fehlenden Bildern hinterlassen. Operationsjournal und Wiederanlauf zuerst. |
| Fehlende Pflicht-Regelinstanzen haben keinen gemeinsamen Vollständigkeitsvertrag | [release-gate.ts](server/services/release-gate.ts) prüft vorhandene `not_run`-Zeilen, aber kein erwartetes Inventar jeder Policy | Score, CLI, Vergleich und KI brauchen denselben validierten Messvertrag. Eine Robustheitslücke, kein hier nachgewiesener falscher Produktiv-Pass. |
| UI-Historie wird global begrenzt und aufwendig geladen | Standardmäßig 300 Checks/3.000 Aufgaben; `/api/bootstrap` liest Berichte, bevor es `audit` entfernt | Projekte können im UI unvollständig erscheinen; projektbezogene Paginierung und Zusammenfassungen vor neuen Trendfunktionen. |
| Ergebnis und Ressourcenfreigabe sind unterschiedliche Zustände | Runner speichert das Ergebnis vor Ende des Kindprozesses; globale und komponentenlokale Busy-Zustände | „Messung fertig, Browser wird beendet“ muss als verständlicher eigener Zustand erscheinen. |
| Die KI verwechselt Fakten trotz bekannter Referenzen | Realer Lauf: nur mobile Befunde werden Desktop/Tablet zugeschrieben, `#wide` wird `.wide`, eine Mindestbreite behebt keine feste Breite | Messfakten typisiert aus dem Bericht erzeugen; Modellhypothesen und Maßnahmen separat prüfen. |
| Der Arbeitsablauf verteilt sich auf mehrere Ansichten | Neun Projekttabs, Tasks ohne eingebetteten Originalnachweis, eigene KI-/Übergabedialoge; Navigation nur im React-State | Ein gemeinsamer Fix-Arbeitsbereich mit stabilen internen URLs. |
| Updates erschweren langfristige Vergleiche | [comparison.ts](server/services/comparison.ts) vergleicht die gesamte Provenienz einschließlich App-/Node-Version | Kompatibilität differenziert modellieren; keine pauschale Lockerung der bestehenden Verifizierungsregeln. |
| Installation und Live-Google sind noch nicht vollständig validiert | [2.0-Grenzen](docs/RELEASE-2.0.md#still-open); Launcher erkennt Bereitschaft an erfolgreicher Root-Antwort | Instanzgebundener Startnachweis; native/Google-Abnahme als eigenständige Tracks. |

Die ersten beiden Risiken sind am Codepfad bestätigt, **kein Nachweis, dass bestehende Nutzerdaten bereits beschädigt wurden**. Sie sollten vor weiterer automatisierter Bereinigung bearbeitet werden.

## Lieferfolge

Jede Version soll einen benutzbaren vertikalen Ablauf liefern. Die Nummern sind eine Reihenfolge, keine Kalenderzusage. Aufwand wird relativ als **M** (mehrere zusammenhängende Änderungen) oder **L** (mehrere Komponenten/Abnahmen) bezeichnet; Zeit- und Budgetplanung folgt nach dem 2.1-Spike.

| Version | Schwerpunkt | Sichtbarer Nutzerwert | Aufwand |
| --- | --- | --- | --- |
| **2.1** | Datenintegrität und gemeinsame Messverträge | Belege bleiben erhalten; fehlende Messungen werden überall gleich behandelt. | M–L |
| **2.2** | Ein zusammenhängender Fix-Arbeitsbereich | Aufgabe, Screenshot, Messung, Erklärung und Nachtest an einem Ort. | L |
| **2.3** | Faktengebundene Erklärungen und überprüfbare KI-Entwürfe | Konkretere Hilfe mit getrennten Fakten, Hypothesen und redaktioneller Freigabe. | L |
| **2.4** | Änderungshistorie, Issue-Verlauf und Neubaselines | Nach einem Update erkennen, was neu, weiterhin offen oder tatsächlich behoben ist. | L |
| **2.5** | Auftragsverwaltung, Diagnose und große Sicherungen | Verständliche Hintergrundarbeit, wiederaufnehmbare Wartung und weniger Ratespiel bei Fehlern. | L |
| **2.6** | Entwicklungs- und Releaseworkflow | Gespeicherte Profile und Baselines werden im eigenen Entwicklungsprozess praktisch nutzbar. | M–L |
| **2.7** | Nutzbare Sichtbarkeitsdaten; begrenztes Fix-Labor als Experiment | Wichtige Landingpages auswählen; eng unterstützte CSS-Ideen vor dem Einbau untersuchen. | M–L, geteilt |
| **2.8** | Zuverlässiger Start und qualifizierte Distribution | Vom Download zum laufenden Workspace mit klaren Voraussetzungen und Rückweg. | L, plattformabhängig |
| **2.9** | Reale Nutzung, Zugänglichkeit und Release Candidate | Kernabläufe mit echten Personen und gewachsenen Datenbeständen verbessern. | L, externe Termine |
| **3.0** | Nachgewiesener stabiler Gesamtworkflow | Ein belastbares lokales Produkt mit klar ausgewiesenen experimentellen Erweiterungen. | Freigabemeilenstein |

### 2.1 — Vertrauen zuerst

**Umgesetzt:** vollständige SQL-Referenzen, transaktionales Archivieren, Wartungsjournal/Wiederanlauf, geprüfte atomare Vorsicherung, zentraler Bereitschaftsstatus und gemeinsamer Messvertrag. Siehe [2.1-Abnahme und Grenzen](docs/RELEASE-2.1.md). Das getrennte Evaluationsset ist ein interner synthetischer Start; unabhängige Beschriftung und semantische Modellprüfung stehen weiter aus.

**Verantwortung:** Backend/Architektur und QA; KI/Frontend für den gemeinsamen Faktenvertrag.

- Vollständige Referenzabfragen direkt gegen die Datenbank: Verifizierungen, Retests, Analysen, Referenzen und Zeitpläne. UI-Paginierung darf keine Aufbewahrungsentscheidung beeinflussen.
- Journal für Archivieren, endgültige Bereinigung und Sicherung. Dateischritte und DB-Übergänge müssen nach Abbruch zuordenbar und wiederaufnehmbar sein. Backups temporär schreiben, prüfen und atomar sichtbar machen.
- Schlanker zentraler Readiness-/Busy-Vertrag: Ergebnis gespeichert, Worker im Aufräumen, Ressourcen frei und erlaubte nächste Aktionen. 2.2 nutzt ihn bereits; die vollständige persistierte Auftragsverwaltung folgt in 2.5.
- Gemeinsamer versionierter Report-Vertrag: erwartete Regelinstanzen je aktiviertem Profil, eindeutige Referenzen, erforderliche Seitenzustände, Messfehler und unbekannte Bereiche.
- Messfakten für die Oberfläche ausschließlich aus kanonischen Feldern auflösen. Freie Modelltexte dürfen keine eigene Quelle für Gerät, Selektor, Zahlen oder „bestanden“ werden.
- Früher Beginn des separaten Evaluationssets und klare Unterscheidung zwischen Verarbeitungsvollständigkeit, Faktenprüfung und menschlicher Freigabe.

**Abnahme:** Mehr als 3.000 Aufgaben dürfen keine Referenz aus dem Schutz verschwinden lassen. Unterbrechungen an jedem Lösch-/Sicherungsschritt hinterlassen einen konsistenten oder wiederherstellbaren Zustand. Entfernte Pflichtregeln, fehlende Kategorieinstanzen und ungültige Referenzen ergeben in CLI, Score, Vergleich und Erklärung „unbekannt/ungültig“, keinen Pass.

**Stoppregel:** Keine zusätzliche automatische Bereinigung oder Parallelisierung, solange diese Fälle nicht geprüft sind. Falls nötig zuerst ein kleines 2.0.x-Datenintegritätspaket, statt auf den kompletten 2.1-Umfang zu warten.

### 2.2 — Weniger Navigation, mehr erledigte Arbeit

**Verantwortung:** Produkt/UX und Frontend; Backend für paginierte Abfragen.

- Wenige primäre Bereiche: Projekte/Übersicht, Prüfen, Arbeiten, Verlauf. SEO, Zustände und KI werden dort kontextbezogene Detailansichten.
- Fix-Arbeitsbereich: Aufgabenliste, ausgewählte Fundstelle, Originalnachweis und Messung; daneben Erklärung, Entwicklerübergabe und Nachtest. Reichweitenpriorität öffnet die konkrete Aufgabe.
- Interne URLs für Projekt, Check und Aufgabe; Reload, Zurück/Vorwärts und kopierte Links erhalten den Arbeitskontext. Fehlende oder archivierte Ziele bekommen eine verständliche Rückkehrmöglichkeit.
- Filter und unkritische Entwürfe projektbezogen erhalten. Quellzugriff, Tokens und Freigaben werden dadurch nicht stillschweigend erneuert.
- Projektbezogene Cursor-Paginierung, Suche und schlanke Check-Zusammenfassungen. Berichte erst bei Bedarf laden, statt alle großen JSON-Dokumente im Bootstrap zu verarbeiten.
- Lesbare Textskala und progressive Details. Fenn bekommt eine reservierte Dock-/Seitenfläche, die keine Zahlen oder Aktionen verdeckt. Bestehende Brand-CI beibehalten.

**Abnahme:** Eine Aufgabe lässt sich ohne Verlust von URL/Gerät/Zustand vom Originalnachweis bis zum Nachtest bearbeiten. Reload/Zurück stellt den gewählten Kontext wieder her. Mit 1.000 Checks und 10.000 Aufgaben bleibt die Historie vollständig erreichbar; Antwortzeit und Speicher werden veröffentlicht. Layoutprüfung bei 320/390/768/1280 px und 200 % Zoom, ohne verdeckte Kernaktionen.

### 2.3 — Fenn erklärt einen belegten Zustand

**Verantwortung:** KI/QA und Fullstack; redaktionelle UX durch Produkt/Frontend.

- Faktenkarte und globale Geräte-/Regel-/Befundmatrix deterministisch erzeugen. Freie Zusammenfassungen aus früheren Modellteilen werden nicht wieder als Messfakten in eine Synthesekette eingespeist.
- Modellantworten referenzieren typisierte Messwerte und Fundstellen. Ursache, Maßnahme und mögliche Wirkung bleiben eigene Hypothesenfelder; unbekannte Ursache bleibt unbekannt.
- Selektoren aus dem kanonischen Befund einsetzen oder eine bewusst neue Beispielklasse als solche markieren. Kein unbemerkter Wechsel von ID zu Klasse.
- Bearbeitbare Entwürfe: schlechten Code verwerfen, nur korrigierte Schritte übernehmen, „mehr Kontext nötig“ markieren. Originalantwort, Nutzeränderung und spätere Messung behalten getrennte Herkunft.
- Lokales Feedback mit Fehlerklassen statt bloß Daumen hoch/runter: Faktenwiderspruch, unpassender Code, unbrauchbarer Nachtest, fehlender Kontext. Kein automatischer Upload und kein ungeprüftes Training daraus.
- Aktuelle Modellvarianten nur auf demselben eingefrorenen Testset vergleichen. Ein größeres Modell oder Fine-Tuning folgt nur auf eine nachgewiesene Fehlerhypothese und einen gemessenen Vorteil.

**Abnahme:** Die bekannten 2.0-Geräte-/Zahlen-/Selektorfehler gelangen nicht in die Faktenkarte oder eine freigegebene Maßnahme. Umordnung oder andere Partitionierung desselben Berichts ändert die Faktenzusammenfassung nicht. Evaluation zählt sachliche Fehler, brauchbare Maßnahmen, sinnvolle Verweigerungen, Teilantworten, Abdeckung und Laufzeit getrennt. Ein Modell, das alles ablehnt, gilt nicht automatisch als gut.

**Externe Voraussetzung:** Unabhängige Beschriftung und ein getrenntes Testset werden früh organisiert. Bis diese tatsächlich vorliegen, bleiben Ergebnisse interne Regressionen und die generative Beratung experimentell. Der regelbasierte Fakten-/Arbeitsablauf funktioniert weiter ohne Modell.

### 2.4 — Verstehen, was sich verändert hat

**Verantwortung:** Backend/Datenmodell, Frontend und QA.

- Dauerhafte Problemidentität von einzelnen Messvorkommen trennen. Unsichere Zuordnungen oder geänderte Selektoren bekommen einen Prüfstatus, keine automatisch behauptete gemeinsame Ursache.
- Benannte Läufe, Profile und Referenzstände; Vollcheck, Teilnachtest, genauer Zeitpunkt und Umfang bleiben überall sichtbar. Historische Fix-Vorgänge sind nicht gleich aktueller Projektzustand.
- Änderungsansicht: neu, wieder aufgetreten, weiter vorhanden, bestätigt behoben, nicht erneut geprüft, inkompatibel. Jede Zeile führt zu Vorher-/Nachher-Nachweisen.
- Messvertrag, Regel-/Aufnahmeidentität und Anwendungsversion getrennt erfassen. Vor einer Lockerung alle relevanten Identitätsbestandteile inventarisieren; insbesondere auch Profilnormalisierung und Verifizierungslogik berücksichtigen.
- Drei explizite Vergleichsstufen: exakt verifizierbar, eingeschränkt diagnostisch gegenüberstellbar, inkompatibel. Eine reine UI-Änderung soll nicht unnötig alle Trends beenden; ein Browser-/Regel-/Zustandswechsel darf aber keine falsche Behebung erzeugen.
- Geführter Baseline-Wechsel mit zwei kontrollierten Messständen. Alte Messungen bleiben unverändert; kein nachträgliches Umetikettieren auf einen neuen Vertrag.

**Abnahme:** Ein UI-Patch, Regelwechsel, fehlender Gerätezustand und Browserwechsel werden durch eine feste Kompatibilitätsmatrix geprüft. Eingeschränkte Trends erzeugen weder bestätigte Fixes noch ungeprüfte Score-Deltas. Migration und Restore erhalten Problem- und Nachweisverknüpfungen.

### 2.5 — Verständlicher und ausfallsicherer Betrieb

**Verantwortung:** Backend/Runtime, QA und Frontend.

- Gemeinsames persistiertes Auftragsmodell für Browser, KI, Export, Backup und Wartung; klare Zustände einschließlich „abschließen/aufräumen“ und tatsächlicher Ressourcenfreigabe.
- Ein Auftragsbereich zeigt aktive Arbeit, Wartegrund, Fortschritt, Abbruch und Rücksprung zum Kontext. Eine gesperrte Aktion wird vor dem Klick erklärt, nicht erst durch HTTP 409.
- Zeitpläne unterscheiden verpasste App-Laufzeit von Ressourcenwarten. Nachholverhalten ist ausdrücklich wählbar und begrenzt; kein unkontrollierter Nachholstapel.
- Lokale, begrenzte Diagnose mit Auftrags-ID, Phase, Versionen und redigierter Ursache. Sensible Inhalte nicht pauschal protokollieren; Diagnosepakete nur auf bewussten Export.
- Größere Sicherungen in begrenzter Hintergrundarbeit mit Fortschritt, Abbruch und projektbezogener Auswahl. Speicher- und Bildgrenzen offen anzeigen; keine blockierende Vollkompression im UI-Prozess.

**Abnahme:** Neustart, Abbruch, voller Datenträger und Workerfehler sind verständlich und wiederaufnehmbar. Ein kontrollierter 24-Stunden-Lauf prüft Zeitpläne und Ressourcen. Große Backups über dem bisherigen 250-MiB-/2.000-Bilder-Szenario werden mit definiertem Speicherbudget, Integritätsprüfung und Wiederherstellung geprüft. Schedules bleiben nach Restore bis zur erneuten Freigabe aus.

### 2.6 — Im Entwicklungsprozess brauchbar

**Verantwortung:** Fullstack/DevEx, QA und Produkt.

- Profile und Baselines im UI benennen, erklären und für lokale Vorschau-/Staging-URLs gezielt nutzen. Quell-/Build-Identität mitführen, wenn nachgewiesen; lokale Portänderungen nicht heimlich gleichsetzen.
- CLI- und Projektansicht verwenden denselben Messvertrag und dieselbe Gate-Policy. Ergebnis zeigt getrennt neue Blocker, bestehende Probleme und Messlücken.
- Reproduzierbarer GitHub-Actions-Ablauf mit gepinnter Toolversion und bewusstem Baseline-Lebenszyklus: erstmals erzeugen, prüfen, übernehmen, nach kompatiblen Änderungen ersetzen.
- Maschinenlesbare Ausgabe und kompakte Check-Zusammenfassung; optional SARIF. Quellzeilen-Annotationen nur bei nachgewiesener Zuordnung. Eine Website-URL wird nicht als erfundene Projektdatei ausgegeben.
- Arbeitspakete mit erlaubtem Umfang, minimalen ausgewählten Nachweisen und Abnahmetest. Keine automatische Übertragung privater Screenshots oder Quelltexte.

**Abnahme:** In einem eigenen Testrepository wird eine echte Regression vor Merge rot, eine Korrektur grün und ein Browser-/Abdeckungsfehler gesondert unbekannt. Baseline-Erzeugung und -Wechsel funktionieren ohne private Artefakte ungefragt zu veröffentlichen. Unbestätigte Quelltreffer bleiben unbestätigt.

### 2.7 — Zwei getrennte Mehrwertpakete

**A · Sichtbarkeit nutzbar machen — Connector-Track, Verantwortung SEO/Fullstack/UX**

- Quelle → Property → Zeitraum → Länder-/Gerätefilter → Vorschau → Import. Keine JSON-Eingabe als normaler Einrichtungsweg; CSV bleibt gleichwertig.
- Tatsächlich autorisierten Google-Abruf, Refresh, Widerruf, abgelaufene Freigabe und Kontingentfehler testen. Quelle, Zeitraum, Datenstand, Filter und Lücken bilden die Datensatzidentität.
- Kompatible Perioden auf Seitenebene vergleichen; fehlende Zeilen sind kein bewiesener Klickverlust. Landingpages bewusst aus Daten für einen Check auswählen.
- Optional CrUX mit gesonderter URL-/Origin-/Zeitraum-Herkunft. Felddaten, lokale Labormessung und Audit-Score bleiben getrennt.

**Abnahme A:** Ein echter berechtigter Account durchläuft Import und Widerruf. Unterschiedliche Filter/Kohorten erzeugen keine erfundenen Deltas. Ohne Zugang bleibt der Connector unvalidiert; CSV und Kernworkflow bleiben nutzbar.

**B · Fix-Labor — begrenztes Experiment, Verantwortung Browser/KI/UX**

- Eine ausdrücklich ausgewählte CSS-Idee in einem flüchtigen, begrenzten Prüfzustand vergleichen: Original, Änderung, gemessener Effekt und Nebenwirkungen.
- Nur unterstützte CSS-Operationen; keine beliebigen Skripte, Projektänderungen oder Commits. Netzwerk-/Ausführungsmodell und mögliche Seiteneffekte vor einem Produktversprechen in einem Spike klären.
- Eine geänderte Vorschau heißt „temporäre Vorschau geprüft“, niemals „Live-Fix verifiziert“. Der echte Quellfix benötigt weiterhin einen frischen kompatiblen Nachtest.

**Abnahme B:** ID-/Klassentausch und wirkungslose Mindestbreite werden an eigenen positiven/negativen Fällen sichtbar; erreichbare Inhalte und relevante Zustände bleiben geprüft. Änderung ist rückstandsfrei zurücksetzbar. Bei unzureichender Messbarkeit bleibt dieses Paket außerhalb des stabilen 3.0-Kerns.

A und B sind keine gegenseitigen Abhängigkeiten und müssen nicht gemeinsam in ein Release gepresst werden.

### 2.8 — Ein verlässlicher Einstieg

**Verantwortung:** Runtime/Distribution, QA und UX.

- Instanzgebundener Health-/Versions-Handshake des gestarteten Dienstes, begrenzte Startzeit und klare Portkonfliktanzeige. Eine beliebige HTTP-200-Antwort am Port reicht nicht als Bereitschaftsnachweis.
- Geführte Laufzeit-/Browser-/optionale Modellprüfung mit verständlicher Reparaturanleitung. Downloads bleiben sichtbar und bewusst gewählt.
- Frische Installation, Upgrade mit bestehenden Daten, fehlgeschlagener Start/Update und Rückweg werden aus dem ausgelieferten Paket geprüft.
- Desktop-Machbarkeit als eigenes Arbeitspaket: vorhandenen React-/Node-Kern beibehalten, Tauri/Sidecar oder Alternative anhand tatsächlicher Startzeit, Paket-/Updategröße, Ressourcen und Prozesslebenszyklus entscheiden. Keine Architekturwahl allein wegen eines vermeintlich kleineren Frameworks.
- Signierte/notarisierte native Veröffentlichung nur mit verfügbaren Zertifikaten und tatsächlich geprüfter Lieferkette. Windows-Unterstützung erst nach einem echten Windows-Lauf, nicht durch Cross-Compilation erklären.

**Abnahme:** Ein fremder Dienst am Port wird nicht als SiteFenn gestartet erkannt. Auf dem jeweils beanspruchten Zielsystem sind Installation, Datenübernahme und Recovery reproduzierbar. Der lokale Web-/CLI-Kern bleibt eigenständig lieferbar; native Vorschaupakete sind getrennt gekennzeichnet.

### 2.9 — Pilot statt weiterer Wunschliste

**Verantwortung:** Produkt/UX, QA und externe Teilnehmende.

- Mindestens fünf externe Teilnehmende bearbeiten drei vorab festgelegte Kernaufgaben: Befund verstehen, gezielte Arbeit übergeben, Fix nachtesten und Ergebnis wiederfinden.
- Fünf bis acht ausdrücklich freigegebene Projekte mit unterschiedlichen Vorlagen/Zuständen einbeziehen. Eigene Testseiten bleiben Regressionen und werden nicht als externe Nutzerstudie umetikettiert.
- Vorher Erfolgskriterien festlegen, Hilfe/Abbrüche dokumentieren, Fehlalarme und falsche Verifizierungen einzeln nachprüfen. Vorgeschlagenes Bedienziel: **mindestens vier von fünf erfolgreiche Durchläufe je Kernaufgabe**, jeweils ohne Implementiererhilfe; zusätzlich keine falsche Fix-Verifizierung. So kann eine durchgehend schwierige Aufgabe nicht durch Erfolge bei einfacheren Aufgaben verdeckt werden. Das ist ein kleiner Produktpilot, kein statistischer Nachweis allgemeiner Gebrauchstauglichkeit.
- Tastatur, Zoom und mindestens ein echter VoiceOver-Durchgang auf dem Hauptsystem. Weitere Plattform-/Screenreader-Unterstützung nur nach entsprechenden realen Läufen behaupten.
- Fehler und nicht abgeschlossene Abnahmen in einem Release-Candidate-Bericht veröffentlichen; P0/P1-Blocker vor neuen Funktionen bearbeiten.

**Abnahme:** Kritische Datenintegritätsfehler und falsche Fix-Verifizierung sind Releaseblocker. Die vorab vereinbarten Kernaufgaben und Zugänglichkeitschecks sind dokumentiert abgeschlossen. Ein verfehltes Ziel verschiebt die Freigabe oder erfordert eine ausdrücklich dokumentierte Umfangsentscheidung, kein stilles „trotzdem fertig“.

### 3.0 — Freigabe des zusammenhängenden Produkts

Die reguläre 3.0-Freigabe umfasst den belastbaren lokalen Web-/CLI-Kern. Google, generative Beratung, Fix-Labor und native Pakete erhalten jeweils einen eigenen ausgewiesenen Reifegrad. Ein experimenteller Zusatz darf den Kern nicht als ungeprüft erscheinen lassen; ein funktionierender Kern qualifiziert den Zusatz umgekehrt nicht automatisch.

**Pflicht für den stabilen Kern:**

- Vollständiger Referenzschutz und geprüfter Wiederanlauf von Datei-/DB-Operationen.
- Gemeinsamer Messvertrag; fehlende Pflichtabdeckung kann keinen grünen Gate-/Verifizierungsstatus erzeugen.
- Zusammenhängender Fix-Arbeitsbereich, vollständige projektbezogene Historie und erklärbare Vergleichbarkeit.
- Vollständige Reparatur-/Retest-/Restore-Kette ohne Modell. Aktivierte, fehlgeschlagene oder widersprüchliche KI darf den Kernablauf nicht beschädigen oder falsche Verifizierungen erzeugen. Erfolgreiche generative Hilfestellung braucht die zusätzliche separate KI-Abnahme.
- Getrennte, vorab eingefrorene Evaluation; mindestens 100 neu beschriftete Befundfälle als vorgeschlagener Startumfang aus unterschiedlichen Vorlagen, getrennt von Entwicklung/Promptanpassung. Herkunft, Konfliktfälle und unabhängige Beteiligung wahrheitsgemäß benennen.
- Abgeschlossener kleiner Nutzungspilot und reale Zugänglichkeitsprüfung der Kernaufgaben.
- Ressourcen-/Laufzeitmessungen auf definierter Hardware, getrennt für Audit, Performance-Labor, Modell und Sicherung; Vergleich mit der 2.0-Basis.
- Ausgeliefertes Paket installieren, vorhandene 2.0-Daten übernehmen, Updatefehler und Restore prüfen. Keine angeblich unterstützte Plattform ohne tatsächlichen Lauf.

**Zusätzliche Freigabe einer KI-Funktion:** Kritische Geräte-/Zahlen-/Selektorwidersprüche dürfen keine sachlich freigegebene Maßnahme passieren. Vorab vereinbarte Schwellen für Nützlichkeit, Abdeckung und sinnvolle Verweigerung prüfen; keine reine Regex-/JSON-Annahmequote als Antwortqualität verkaufen. Wenn diese Abnahme nicht gelingt, bleibt die Funktion ausdrücklich experimentell. Erst danach über neue Modelle, Vision oder kuratiertes Training entscheiden.

## Fullstack-Leitplanken

- Bestehenden Stack weiterverwenden. `server/app.ts` enthält derzeit rund 1.560 Zeilen; Routen und Anwendungsfälle schrittweise nach Scans, Aufgaben, Erklärungen, Wartung und Integrationen schneiden. Lokale Sitzungs-/Zugriffskontrolle bleibt zentral, kein Microservice-Neubau.
- HTTP-, importierte Report- und Persistenzverträge zur Laufzeit validieren, statt sich allein auf TypeScript-Typen zu verlassen. Gemeinsame versionierte Schemata verhindern unterschiedliche Bedeutungen in UI, CLI und KI.
- Berichte als unveränderte Messartefakte erhalten; relationale Indizes für Suche, Lebenszyklus und Referenzen ergänzen. Eine klare Quelle je Fakt, keine konkurrierenden Kopien desselben Status.
- Migration, beschädigte Datensätze, Abbruch an Datei-/DB-Grenzen, volle Datenträger und gewachsene Workspaces sind eigene Testfälle. Die Anzahl grün gewordener Tests allein ist kein Produktziel.
- API-/UI-Latenz, Browser-/Modelllast und Backup-Speicher getrennt messen. Parallelität erst nach Ressourcenmessung und klarer Reservierung erhöhen.
- Export, Quellvorschau, Diagnose und Trace-Aufnahmen brauchen einen erkennbaren Datenumfang. Credentials bleiben im geeigneten OS-Speicher; kein automatischer Upload von Quelltext, Screenshots oder lokalem Nutzerfeedback.

## Abhängigkeiten und Lieferdisziplin

Die stabile Reihenfolge lautet **Daten/Messvertrag → gemeinsamer Arbeitsbereich → überprüfbare Erklärungen → belastbarer Verlauf → Betrieb/Releaseintegration → Pilot/Freigabe**. Der Google-Track kann nach der Daten-/Vertragsgrundlage parallel beginnen; native Distribution braucht zuerst Auftrags-, Diagnose- und Recovery-Grundlagen. Das Fix-Labor hängt von Faktenvertrag und reproduzierbaren Zuständen ab.

Für jedes Lieferpaket:

1. Kleinen benutzbaren Ablauf und explizite Nichtziele festlegen.
2. Notwendige API-/Daten-/UI-Änderung samt Migrations-/Recovery-Folgen konkret machen.
3. Passende Regressionen und echten Integrationslauf durchführen; Modell-, Protokoll-, Plattform- und Menschenprüfung getrennt ausweisen.
4. README, Changelog und echte Screens/bei sinnvollem Ablauf ein GIF aktualisieren. Nur eigene oder zur Veröffentlichung freigegebene Inhalte verwenden.
5. Eigenen Commit/Push und Release mit genauem Quellstand, geprüftem Paket und tatsächlichem CI-Status veröffentlichen. Kein Versionssprung nur zur Erfüllung der Tabelle.

**Keine Voraussetzung für 3.0:** Mehrbenutzer-SaaS, Cloud-Sync, allgemeiner Ranktracker, automatischer Quellcode-Commit/Deployment, autonomes Durchklicken fremder Seiten, verpflichtende Modellschulung oder neue Mascot-Animationen.

## Technische Primärreferenzen

- [Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer): vorhandene lokale Ablauf-/Nachweisdiagnose als mögliche Grundlage, keine automatische Freigabe zum Teilen von Traces.
- [Ollama Structured Outputs](https://docs.ollama.com/capabilities/structured-outputs): Schemas strukturieren Antworten; die tatsächlichen SiteFenn-Ausgaben zeigen die weiterhin nötige Sachprüfung.
- [Google Search Analytics Query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query): Dimensions-/Filterabfragen und begrenzte zurückgegebene Zeilen; keine garantierte vollständige Property-Tabelle.
- [Tauri Sidecars](https://v2.tauri.app/develop/sidecar/): externe Laufzeitprogramme müssen tatsächlich pro Zielsystem verpackt und geprüft werden.
