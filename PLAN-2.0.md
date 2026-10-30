# SiteFenn — Verbesserungsplan bis 2.0

Stand: 29. Oktober 2026. Vorschlag auf Basis des veröffentlichten 1.0-Codes und seiner tatsächlichen Release-Prüfung. Dieser Plan beschreibt zukünftige Arbeit, keine bereits vorhandenen Funktionen. Es wurden dafür keine externen Fachpersonen oder Nutzer konsultiert.

Fortschritt 1.1: Referenzläufe, Regressionen, drei autorisierte Real-Websites, Messgrenzen und frühe Machbarkeitsprüfungen sind in [BASELINE-1.1.md](docs/BASELINE-1.1.md) und [RELEASE-1.1.md](docs/RELEASE-1.1.md) dokumentiert. Das Repository heißt jetzt `sitefenn`; Daten bleiben im bisherigen Verzeichnis. Eine unabhängige menschliche Beschriftung und ein separates zurückgehaltenes Testset sind weiterhin offen. Die neue synthetische Auswertung ersetzt diese nicht.

Fortschritt 1.2: Fix-Arbeitsbereich, Filter/Bündelung und der erste durchgängige lokale Ablauf „Seite erklären“ sind implementiert. Teilfehler, Kontextgrenzen und ungeprüfte Vorschläge bleiben sichtbar. [RELEASE-1.2.md](docs/RELEASE-1.2.md) dokumentiert Tests und Modellgrenzen. Der im Plan geforderte moderierte Nutzertest wurde noch nicht durchgeführt; die unabhängige UX-Abnahme ist damit ausdrücklich offen.

Fortschritt 1.3: Visuelle Referenzen, Masken, Wisch-/Pixelvergleich und gezielte Maßnahmen-Nachtests sind implementiert. Ein eigener realer Browser-Test bestätigt einen korrigierten Befund, lässt die ausgelassene Seite offen und prüft Backup/Restore der Referenz. Grenzen und tatsächliche Prüfungen stehen in [RELEASE-1.3.md](docs/RELEASE-1.3.md). Keine allgemeine visuelle Erkennungsgenauigkeit oder unabhängige UX-Abnahme wird daraus abgeleitet.

Fortschritt 1.4: Begrenzter Sitemap-Import, gerichteter Linkkontext mit HTTP-/Redirect-Stichproben, Metadaten-Kandidaten, Canonical-/Robots-Kontext und ein getrenntes Breadcrumb-Teilprofil sind implementiert. Kontrollierte positive/negative Fälle und ein echter korrigierter Link-Nachtest sind in [RELEASE-1.4.md](docs/RELEASE-1.4.md) dokumentiert. Kein vollständiger Crawl, Indexierungsnachweis oder Rankingverlust wird daraus abgeleitet.

Fortschritt 1.5: Freigegebene Startseiten-/UI-/Scroll-Abläufe, erwartete Zustände, Vorher-/Nachher-Nachweise und Zustands-Nachtests sind implementiert. Fehlende Ziele, Blockierungen, unerwartete URL-Wechsel und Zeitlimits bleiben unbekannt. Kontrollierte Menü-/Dialog-/Akkordeonfälle und die echte korrigierte Menüprüfung stehen in [RELEASE-1.5.md](docs/RELEASE-1.5.md). Unterstützung ist bewusst auf deklarierte native UI-Schalter begrenzt; keine authentisierten oder autonomen Mehrseitenabläufe.

## Produktziel

**SiteFenn hilft dir, Website-Probleme nachweisbar zu beheben und neue Fehler vor der Veröffentlichung zu erkennen.**

Der Kernablauf für 2.0 lautet:

**Website auswählen → relevante Änderungen erkennen → belegten Befund öffnen → konkrete Maßnahme bearbeiten → gezielt nachtesten → Ergebnis dokumentieren.**

Vier zentrale Erweiterungen:

1. Ein Fix-Arbeitsbereich verbindet Screenshot, Element, Messung, Vorschlag und Abnahmetest.
2. Ein visueller Vorher-/Nachher-Vergleich zeigt Veränderungen unter vergleichbaren Bedingungen.
3. Fenn interpretiert den strukturierten Bericht jeder Seite und erklärt konkrete Lösungsmöglichkeiten; Sichtbarkeitsdaten ergänzen die Arbeitsreihenfolge.
4. Eine installierbare lokale Anwendung vereinfacht Start, Abhängigkeiten, Sicherung und Updates.

## Ausgangslage: Was 1.0 bereits kann

Projekte, begrenzte Seitenauswahl, drei Chromium-Profile, Live-Bilder, Nachweise, axe-/SEO-/Runtime-Prüfungen, optionale Lighthouse-Messungen, Aufgaben, Score-Grenzen, Vergleich, Exporte, GSC-CSV und Backup/Restore sind vorhanden. Der dokumentierte Stand umfasst 65 Node-Tests, neun Browser-Tests und erfolgreiche macOS-/Ubuntu-CI.

Wesentliche Lücken:

- Keine unabhängige Erkennungsstudie oder externe Nutzererprobung.
- Ein lokaler Modelltest lieferte eine sachlich falsche Erklärung trotz gültigem JSON und korrekten Referenzen.
- Begrenzte Seitenzustände und Layoutregeln; keine vollständigen Nutzerabläufe.
- Kein visueller Änderungsvergleich mit freigegebenen Referenzaufnahmen.
- Keine Quellcode-Zuordnung und keine gezielte Wiederholungsprüfung einzelner Maßnahmen.
- Google-Daten kommen per CSV; Installation setzt derzeit Entwicklerwerkzeuge voraus.
- Windows, vollständige Screenreader-Bedienung und Ressourcenverhalten sind nicht hinreichend geprüft.

Diese Lücken haben Vorrang vor zusätzlichen Dashboard-Kacheln und Avatar-Animationen.

## Lieferpakete

### 1.1 — Verlässlichkeit und echte Baseline

**Nutzen:** Wir wissen, welchen Ergebnissen man im definierten Prüfbereich vertrauen kann.

- Wiederholbare Referenzläufe und ein getrenntes, manuell beschriftetes Testset mit erlaubten und fehlerhaften Layouts.
- Ergebnisse je Regel: Fehlalarme, übersehene Probleme, nicht prüfbare Zustände und Stichprobengröße.
- Reale, ausdrücklich freigegebene Projekte zusätzlich zu eigenen Fixtures testen. Zustimmung und Screenshots nicht automatisch veröffentlichen.
- Regel-, Browser-, Prompt- und Modellidentität nachvollziehbar speichern; historische Messungen erhalten.
- Auf dem M5 Pro mit 24 GiB Spitzenverbrauch, Laufzeit, Abbruch und Live-Verzögerung messen.
- Frühe Machbarkeitstests für Desktop-Paketierung und Google-OAuth durchführen, damit spätere Lieferpakete realistisch bleiben.

**Abnahme:** Veröffentlichter Testbericht; bekannte schwere Fehlalarme korrigiert oder betroffene Erkennung sichtbar als Prüfkandidat eingestuft. Noch keine allgemeine Genauigkeitsbehauptung. Zielwerte und unterstützte Umgebungen werden anhand dieser Baseline festgelegt.

### 1.2 — Aufgeräumter Fix-Arbeitsbereich

**Nutzen:** Vom Problem zur nächsten sinnvollen Aktion, ohne sich durch lange Berichte zu arbeiten.

- Klare Bereiche: Websites, Prüfungen, Maßnahmen, Sichtbarkeit und Einstellungen.
- Pro Befund eine zusammenhängende Ansicht: Originalnachweis, Elementmarkierung, Beobachtung, Regel, Maßnahme und Abnahme.
- Filter nach Seite, Gerät, Kategorie, Priorität und Status; URL-Zeilen und technische Details bei Bedarf aufklappen.
- Ähnliche Beobachtungen nachvollziehbar bündeln; die einzelnen Fundstellen bleiben erreichbar.
- Fenn erhält einen eigenen Bereich „Seite erklären“ mit Seitenzusammenfassung, verknüpften Befunden, Lösungsschritten und Rückfragen zum ausgewählten Seitenbericht. Der erste durchgängige lokale Ablauf wird bereits mit 1.2 geliefert; 1.6 vertieft Evaluation und Qualität. Modellantworten ersetzen keine Messung.
- Deutsche Regeltexte, Tastaturbedienung, Fokusführung, reduzierte Bewegung und verständliche Leer-/Fehlerzustände verbessern.

**Abnahme:** In einem moderierten Test finden Nutzer einen relevanten Befund, verstehen seinen Nachweis und exportieren seine Maßnahme ohne Hilfestellung. Konkrete Probleme dokumentieren; ein geplanter Test gilt erst nach Durchführung als bestanden.

### 1.3 — Vorher/Nachher und gezielter Nachtest

**Nutzen:** Nach einer Änderung muss man nicht jedes Mal den gesamten Projektumfang erneut prüfen.

- Freigegebene Referenzläufe sowie nebeneinanderliegende Bilder, Wischregler und markierte Änderungsbereiche.
- Dynamische Bereiche ausdrücklich maskieren; Masken, Animationseinstellungen, Schriftbereitschaft und Aufnahmebedingungen speichern.
- Visuelle Änderung und regelbasierter Fehler bleiben verschiedene Ergebnisse.
- „Diese Maßnahme nachtesten“ führt die betroffenen URLs, Geräte und zulässigen Zustände erneut aus.
- Teilprüfungen bilden einen eigenen Lauf mit eigener Abdeckung. Sie ersetzen keinen vollständigen Projekt-Score.
- Bei Browser-/Umgebungswechsel Referenzen als eingeschränkt vergleichbar markieren, statt falsche Verbesserungen zu zeigen.

**Abnahme:** Eine absichtlich behobene Regelverletzung wird verifiziert; eine ausgelassene Seite nicht. Legitime Designänderungen können als neue visuelle Referenz bestätigt werden, ohne objektive Regelverletzungen zu löschen.

### 1.4 — Technisches SEO mit Zusammenhang

**Nutzen:** Probleme erkennen, die sich über mehrere Seiten oder Templates ziehen.

- Begrenzter Sitemap-Import mit derselben Host-, Pfad- und Netzwerkfreigabe wie der Crawler.
- Interner Linkgraph, gemessene fehlerhafte Links und Redirect-Ketten.
- Doppelte Titel/Beschreibungen innerhalb des tatsächlich geprüften Umfangs; gemeinsame Template-Fundstellen bündeln.
- Canonical-Ziele und Konflikte mit Robots-/Noindex-Angaben prüfen; Produktions- und Staging-Absicht berücksichtigen.
- Strukturierte Daten: Syntax und gegebenenfalls unterstützte Schema-Regeln getrennt ausweisen.
- Kein pauschaler Rankingverlust für eine fehlende Description; kein „verwaist“-Beweis aus einem unvollständigen Crawl.

**Abnahme:** Kontrollierte SEO-Fälle mit positiven und negativen Beispielen; alle Aussagen nennen ihren beobachteten Umfang. Robots-Regeln sind keine Zugriffserlaubnis und kein Google-Indexierungsnachweis.

### 1.5 — Freigegebene Seitenzustände

**Nutzen:** Auch ein geöffnetes Mobilmenü, ein Akkordeon oder ein Dialog kann geprüft werden.

- Kleine, explizite Abläufe aus Navigation, Scrollen und freigegebenen Elementaktionen.
- Vorschau der Schritte, erwarteter Zustand, Abbruchbedingungen und begrenzte Laufzeit.
- Vorher-/Nachher-Nachweise je Schritt; Menü-/Dialogzustände gehören zum Vergleichsprofil.
- Fehlende Bereitschaft, blockierte Anfragen und nicht reproduzierbare Zustände als unbekannt kennzeichnen.
- Kein autonomes KI-Durchklicken, keine Bestellungen, Formulareinreichungen oder Löschaktionen.
- Authentisierte Bereiche und Session-Import bleiben außerhalb des Pflichtumfangs von 2.0.

**Abnahme:** Definierte Menü-/Dialogfehler werden im richtigen Zustand gefunden und nachgetestet. Verbotene Aktionen und ein fehlendes Zielelement brechen den Ablauf nachvollziehbar ab.

### 1.6 — Seitenberichte konkret interpretieren und Lösungen erklären

**Nutzen:** Das lokale LLM nimmt den erstellten Bericht einer Seite als Kontext, interpretiert die Ergebnisse und erklärt konkrete Lösungsvorschläge. Es ist der erklärende Teil des Audits, nicht nur ein Chat über einzelne Fehlermeldungen.

Der erste vertikale Ablauf gehört bereits zu 1.2. Dieses Lieferpaket macht ihn anhand realer Seitenberichte belastbarer und erweitert die Lösungsqualität.

#### Kontext pro Seite

Eine Analyse ist fest an Projekt, Scan, URL und die geprüften Geräte-/Seitenzustände gebunden. Der Kontext umfasst:

- Seitenzweck und Nutzerziel, wenn angegeben; sonst als unbekannt behandeln.
- Sämtliche vorhandenen Befunde dieser Seite: IDs, Kategorien, Erkenntnisstatus, Prioritäten, Regeln, Beschreibungen und Abnahmekriterien.
- Erfolgreiche, fehlgeschlagene und nicht ausgeführte Prüfungen sowie die tatsächliche Abdeckung. Auch ein fehlgeschlagener Messlauf ist Kontext, kein Webseitenfehler.
- Vorhandene SEO-/Accessibility-/Runtime- und Performance-Ergebnisse, einschließlich rein numerischer Befunde ohne Screenshot.
- Geräte, Zustände, Scrollpositionen und Nachweisreferenzen; verifizierte Selektoren und gemessene Geometrie, soweit vorhanden.
- Für konkrete Layoutlösungen künftig zusätzlich begrenzte relevante DOM-/Style-Ausschnitte erfassen. Formulareingaben, Zugangsdaten und irrelevante Seiteninhalte nicht pauschal übernehmen.
- Vergleichbare frühere Befunde und vorhandene Aufgaben, falls der Nutzer den Vergleich für die Analyse auswählt.

Damit wird die bisherige Auswahl von bis zu zwölf bildbelegten Befunden als einzigem Modellkontext ersetzt. Alle relevanten Berichtsinhalte der gewählten Seite müssen verarbeitet oder ausdrücklich als ausgelassen markiert werden. „Vollständiger Kontext“ bedeutet vollständiger vorhandener Prüfbericht, nicht vollständiges Wissen über die Website oder ihren Quellcode.

Große Berichte werden nach Seite und anschließend nach Kategorie/Zustand in begrenzte Teile zerlegt. Teilinterpretationen behalten Originalreferenzen; eine abschließende Seitenzusammenfassung verknüpft die Ergebnisse. Kein stilles Abschneiden beim Kontextlimit. Verarbeitung auf dem Zielgerät nacheinander, mit Fortschritt und Abbruch. Wenn Teile scheitern, bleibt die Interpretation sichtbar unvollständig.

#### Erwartetes Ergebnis

Pro Seite eine verständliche Zusammenfassung und pro relevantem Problem:

1. **Was wurde beobachtet?** Kanonischer Messbefund mit Nachweis.
2. **Warum ist das relevant?** Auswirkungen im tatsächlich bekannten Nutzungskontext; unbekannte geschäftliche Wirkung nicht erfinden.
3. **Was könnte die Ursache sein?** Belegte Ursache oder ausdrücklich markierte Hypothese samt fehlender Information.
4. **Was soll geändert werden?** Konkrete Schritte am beobachteten Element; passende HTML-/CSS-/JS-Beispiele oder Konfigurationshinweise.
5. **Welche Alternative gibt es?** Nur wenn technisch sinnvoll, mit kurzem Vor-/Nachteil.
6. **Wie prüfen wir den Fix?** Erwarteter Zustand und reproduzierbarer Nachtest für die betroffene Seite und Geräteansicht.

„CSS verbessern“ genügt nicht. Ein Selektor darf nur als tatsächliche Fundstelle erscheinen, wenn er gemessen wurde. Code ohne Quellcodezuordnung ist ein gekennzeichnetes Anpassungsbeispiel; exakte Dateien, Frameworks, Ursachen und Zeilennummern werden nicht erfunden. Wenn die Ursache zusätzliche Daten erfordert, benennt Fenn die konkrete fehlende Messung oder fragt danach.

Übergreifende Ursachen dürfen als Hypothese verknüpft werden, etwa dass mehrere mobile Befunde dieselbe Navigation betreffen. Einzelne Fundstellen bleiben erhalten. Der Scan beweist dadurch noch keine gemeinsame Quellcodeursache.

#### Oberfläche, Rückfragen und Export

- „Seite erklären“ öffnet Analyse und Lösungen neben den zugehörigen Nachweisen.
- „Diesen Befund erklären“ verwendet dieselbe Seitenanalyse mit ausgewähltem Schwerpunkt.
- Rückfragen wie „Wie setze ich das ohne feste Höhen um?“ behalten den zugehörigen Seiten-/Scan-Kontext.
- „Als Maßnahme übernehmen“ erstellt nach Sichtprüfung einen referenzierten Vorschlag mit Status offen, keine verifiziert behobene Aufgabe. Doppelte Aufgaben werden erkannt.
- Seitenanalyse und Lösungen als Markdown exportieren; Messfakten und Modellvorschläge bleiben getrennt.
- Kontextstand, Prompt-/Modellidentität und verarbeitete Teile speichern. Nach einem neuen Scan ist die alte Interpretation historisch, bis sie für die neue Messung erneut erzeugt wurde.

#### Qualität und Grenzen

- Explizite Faktenfelder, beleggebundene Antworten und klare Trennung von Beobachtung, Vermutung und Vorschlag.
- Bei erkannten Widersprüchen Antwort ablehnen oder kennzeichnen. Semantische Richtigkeit lässt sich nicht durch JSON-Validierung garantieren.
- Versionierte Prüfung mit fehlerhaften Eingaben, Negationen, Prompt-Injection-Versuchen und Fällen ohne genügenden Beleg.
- Kleine lokale Modelle anhand der tatsächlichen Aufgaben, Lizenz, RAM-Bedarf und Fehlerquote vergleichen; kein pauschales „größer ist besser“.
- Schrittweise Erklärungen und gegebenenfalls illustrative Codebeispiele; Beispiele nennen keine erfundenen Projektdateien.
- Screenshot-Vision zunächst als freiwilliges Experiment: Bildausschnitt bewusst auswählen, lokal auswerten, Ergebnis als visuelle Hypothese behandeln. Bei unzureichender Evaluation bleibt es außerhalb des stabilen Funktionsumfangs.
- Kein eigener Trainingslauf als Voraussetzung. Erst Evaluation, dann bei nachgewiesenem Bedarf kuratierte Daten und Training prüfen.

**Abnahme:** Ein realer Seitenbericht mit mehreren Geräteansichten und gemischten Kategorien wird lokal interpretiert; Vorschläge referenzieren die richtigen Beobachtungen. Ein großer Bericht wird ohne stille Auslassungen verarbeitet. Fehlende Messwerte bleiben unbekannt. Codebeispiele, Aufgabenübernahme, Rückfragen und Markdown-Export werden durchgängig geprüft. Testkorpus und Fehleranalyse veröffentlichen, einschließlich sachlicher Widersprüche. KI bleibt optional; ohne geeignetes Modell funktioniert der gesamte Mess-/Aufgabenablauf.

### 1.7 — Sichtbarkeit und sinnvolle Prioritäten

**Nutzen:** Zuerst an Seiten arbeiten, die für das eigene Projekt relevant sind.

- Optionaler Search-Console-Zugriff mit rein lesendem OAuth-Scope; CSV bleibt nutzbar.
- Property, Zeitraum, Land, Gerät, Filter, Datenstand und Datenlücken transparent halten.
- Hohe Impressionen bei niedriger CTR oder abnehmenden Klicks als untersuchenswerte Kandidaten anzeigen, nicht als bewiesene Ursache.
- Optional CrUX-Felddaten ergänzen; URL- und Origin-Daten unterscheiden. Fehlende Daten bleiben fehlend.
- Arbeitspriorität aus gemessener Schwere, beobachteter Reichweite und erklärbaren Projektgewichten ableiten; getrennt vom Audit-Score.
- Google-Verbindung ausdrücklich aktivieren und widerrufen können; Tokens über einen geeigneten Betriebssystem-Geheimnisspeicher schützen. OAuth-Konfiguration und gegebenenfalls Anbieterfreigabe sind reale Voraussetzungen.

**Abnahme:** Ein echter, autorisierter Datenabruf und Widerruf werden getestet. Keine erfundenen Summen, Google-Platzierungen oder behauptete Kausalität zwischen Fix und Ranking. Bei fehlendem Google-Zugang wird der Connector als unvalidiert ausgewiesen, nicht als fertig behauptet.

### 1.8 — Übergabe an Entwickler und Release-Prüfung

**Nutzen:** Die Befunde fließen in echte Entwicklungsarbeit ein.

- Einen ausgewählten lokalen Quellordner zunächst nur lesend zuordnen; ignorierte und sensible Dateien ausschließen.
- Nur nachgewiesene Zuordnungen zwischen beobachteten Elementen und Dateien als solche anzeigen. Ohne belastbare Zuordnung bleibt ein Plan ohne Dateibehauptung.
- Export eines gezielten KI-Arbeitspakets: Problem, Nachweis, geprüfte Fundstelle, erlaubter Umfang und reproduzierbarer Abnahmetest.
- CLI für gespeicherte Prüfprofile, maschinenlesbare Ergebnisse und einen beispielhaften GitHub-Actions-Ablauf.
- Neue bestätigte Blocker gegenüber einer kompatiblen Baseline können einen CI-Lauf fehlschlagen lassen. Messfehler und fehlende Abdeckung ergeben einen eigenen Status.
- Keine automatischen Commits, Quellcodeänderungen oder Uploads privater Nachweise. Ein späterer Patch-Entwurf braucht eine separate Vorschau und Freigabe.

**Abnahme:** Eine bekannte Regression wird vor dem Merge erkannt und nach dem Fix grün. Ein Browserfehler wird nicht als fehlerfreie Website ausgegeben. Exportierte Quelldaten bleiben auf den gewählten Umfang begrenzt.

### 1.9 — Installation und Alltagstauglichkeit

**Nutzen:** SiteFenn lässt sich regelmäßig nutzen, ohne jedes Mal ein Terminal einzurichten.

- Desktop-Hülle mit vorhandenem React-/Node-Kern. Tauri mit Sidecar zuerst gegen Chromium-/Node-Verteilung, Prozesslebenszyklus, Lizenzhinweise und Update-Größe prüfen; Entscheidung aus dem Machbarkeitstest dokumentieren.
- Unterstützte Pakete zunächst für macOS Apple Silicon und Windows x64; Linux-Webstart bleibt bestehen. Weitere Varianten erst nach tatsächlicher Prüfung.
- Erster Start prüft Laufzeit, Browser und optionales Ollama. Downloads sind sichtbar und ausdrücklich gewählt.
- Signierung/Notarisierung und verifizierte Updates samt Vorsicherung und getesteter Wiederherstellung. Ohne passende Zertifikate keinen signierten Installer behaupten; keinen unsicheren Auto-Updater als Ersatz liefern.
- Speicherverwaltung, Vorschau vor Löschungen, gezielte Exporte und Aufbewahrungseinstellungen.
- Freiwillige regelmäßige Prüfungen zunächst bei laufender App; verpasste Termine und Ressourcenlimits anzeigen. Kein versteckter Systemdienst.

**Abnahme:** Frische Installation, Update mit alten Projekten, fehlgeschlagenes Update und Wiederherstellung auf den unterstützten Systemen wirklich testen. Windows benötigt einen realen Lauf, nicht nur Cross-Compilation.

### 2.0 — Geschlossener Arbeitsablauf und öffentliche Freigabe

**Nutzen:** Ein neuer Nutzer kann eine Website prüfen, einen relevanten Fehler bearbeiten und dessen Behebung nachvollziehbar bestätigen.

- Durchgängiger Pilot auf fünf bis acht ausdrücklich freigegebenen Projekten mit Entwicklern außerhalb der Implementierung.
- Fehler, Fehlalarme und Bedienprobleme aus dem Pilot beheben; ungelöste Grenzen veröffentlichen.
- Vollständiger Ablauf mit und ohne Modell, bestehende 1.0-Daten, Wiederherstellung, Tastatur und mindestens ein Screenreader auf dem unterstützten Hauptsystem prüfen.
- Ressourcen-/Laufzeitmessungen auf definierter Hardware veröffentlichen; getrennt für Audit, Lighthouse und Modellinferenz.
- Reproduzierbare Installation, tatsächlich getestete Distributionspakete, Demo, echte Screens und Changelog.
- Veröffentlichung erst nach Prüfung des finalen Codes. Offene Pflichtkriterien verschieben die Freigabe oder erfordern eine ausdrücklich neu vereinbarte Umfangsänderung.

## Technische Leitplanken

Den funktionierenden React-/Fastify-/SQLite-/Playwright-Kern weiterverwenden. Kein Neuaufbau allein wegen der Versionsnummer.

- Regelprüfung, visuelle Änderung, Modellinterpretation und Google-Daten bleiben getrennte Module und Ergebnisarten.
- Gemeinsames versioniertes Profil für Seiten, Geräte, Zustände, Masken und Aufnahmebedingungen.
- Alte Daten werden mit Vorsicherung migriert; ältere Reports behalten ihre Version und Aussagekraft.
- Hintergrundarbeit bleibt ressourcenbegrenzt. Kein paralleler Modelllauf während einer Performance-Referenzmessung.
- Neue Credentials, Quellcodezugriff, Screenshots und externe Verbindungen erhalten jeweils eine ausdrückliche Freigabe und nachvollziehbare Datenwege.
- Netzwerkhärtung nicht als allgemeine Isolation gegen feindliche Websites ausgeben. Der vertrauenswürdige, autorisierte Zielbereich bleibt bestehen.

## Erfolgsprüfung

| Frage                           | Messung vor 2.0                                                                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Sind Befunde belastbar?         | Getrenntes beschriftetes Testset, Precision/Recall und unbekannte Fälle je unterstützter Regel, ohne Verallgemeinerung auf alle Websites. |
| Hilft das Produkt beim Beheben? | Im Pilot nachvollziehbarer Befund → Maßnahme → echter Nachtest; erforderliche Hilfestellungen und Abbrüche protokollieren.                |
| Kann Fenn irreführen?           | Semantische Fehler und Widersprüche im versionierten Testkorpus erfassen; unbekannte Antworten und Verweigerungen separat zählen.         |
| Ist der Vergleich fair?         | Kompatibilitätsprüfung, fehlende Zustände, Masken und Browserwechsel als feste Regressionstests.                                          |
| Läuft es auf dem Zielgerät?     | Reproduzierbare Messungen auf M5 Pro/24 GiB; frische Installation und Update auf echtem Windows-System.                                   |
| Bleiben Daten erhalten?         | Migration, Wiederherstellung, Updatefehler und abgebrochene Jobs mit bestehenden Daten testen.                                            |

Konkrete Leistungsziele werden nach 1.1 festgelegt. Eine gute Demo-Laufzeit oder ein einzelner korrekter Modellaufruf ersetzt keine Messreihe.

## Bewusst zurückgestellt

Mehrbenutzer-SaaS, Cloud-Synchronisierung, allgemeines Scannen feindlicher URLs, universeller Ranktracker, automatische Quellcode-Reparaturen, autonome Käufe/Formulare, verpflichtendes Modelltraining, Gamification und große Avatar-Animationspakete.

Optionale Experimente wie Vision dürfen die Stabilisierung des Kernablaufs nicht verdrängen. Lieferpakete sind eine Reihenfolge mit Abnahmekriterien, keine Kalenderzusage. Nach 1.1 wird Aufwand und Reihenfolge anhand der Ergebnisse nachgeschärft.

## Technische Referenzen

- [Playwright: visuelle Vergleiche](https://playwright.dev/docs/test-snapshots): Renderingbedingungen beeinflussen Referenzaufnahmen.
- [Playwright: Screenshot-Assertions](https://playwright.dev/docs/api/class-pageassertions#page-assertions-to-have-screenshot-1): dokumentierte Unterstützung unter anderem für Animationskontrolle.
- [Google: Search-Console-Autorisierung](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing): OAuth und rein lesender Scope.
- [Google: Search Analytics](https://developers.google.com/webmaster-tools/v1/searchanalytics/query): Dimensionen, Aggregation und Datenabfragen.
- [Chrome: CrUX-Methodik](https://developer.chrome.com/docs/crux/methodology): Daten sind nur bei erfüllten Voraussetzungen verfügbar.
- [Tauri: externe Programme als Sidecars](https://v2.tauri.app/develop/sidecar/): Architektur-/Plattformpakete und Berechtigungen müssen tatsächlich umgesetzt werden.
