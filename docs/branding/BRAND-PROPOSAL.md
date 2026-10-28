# SiteFenn – Markenentwurf

Stand: 28. Oktober 2026. **Historischer erster Entwurf, durch [BRAND.md](BRAND.md) überholt.** Die erste dunkle/2.5D-Richtung wird nicht umgesetzt. Auf Nutzerwunsch folgt die aktuelle UI einer flachen Cartoon-/Poster-Richtung. Repository, Paketname und Datenverzeichnis bleiben unverändert; die App zeigt SiteFenn. Version 0.2 ist noch nicht begonnen. Die folgenden Abschnitte dokumentieren die ursprüngliche Überlegung, nicht den aktuellen Implementierungsstand.

## 1. Name und Idee

**Produkt: SiteFenn** · **Begleiter: Fenn**

Aussprache ungefähr „Sait-Fenn“. Schreibweise im Fließtext stets SiteFenn, nicht Sitefenn oder SITE FENN. Technischer Slug nach Freigabe: `sitefenn`, sofern verfügbar.

Site benennt den Gegenstand. Fenn verbindet die Marke mit dem Fennek/Wüstenfuchs als Figur. Die Kombination ist kurz genug für App-Navigation und Repository und lässt Raum für einen Hub mit mehreren Funktionen, statt das Produkt auf einen SEO-Check zu reduzieren.

**Deutsch:** „Sieh das Problem. Kenne den nächsten Schritt.“

**Englischer Descriptor:** „Your local website audit companion.“

Die Figur steht gestalterisch für Aufmerksamkeit und verständliche Begleitung, nicht für nachgewiesene tierische Eigenschaften oder fehlerfreie KI.

Eine erste Websuche ist keine Domain-, Marken- oder Rechtsfreigabe. Verfügbarkeit und mögliche Verwechslungen müssen vor endgültiger Namenswahl separat geprüft werden. Es werden noch keine Domains gekauft, Accounts registriert oder bestehenden Repository-URLs geändert.

Alternativen, wenn die Hauptrichtung nicht passt:

- **PageMarten:** mit einem Marder als ruhigem, detailorientiertem Begleiter; stärker eigenwillig, aber länger.
- **PagePico:** mit einem kleinen Specht; leichter und verspielter, weniger technisch.

Auch diese Namen sind ungeprüfte Entwürfe. Empfehlung bleibt SiteFenn, weil Produkt- und Figurenname zusammen eine klare Identität ergeben.

## 2. Die Figur Fenn

Ein kleiner aufmerksamer Wüstenfuchs mit hohen abgerundeten Ohren, kompakter Silhouette, sandfarbenem Fell, dunklen klaren Augen und einem einzelnen limettengrünen Halsband. Ruhiger freundlicher Gesichtsausdruck, kein breites Dauergrinsen. Ein leicht erhobenes Vorderpfötchen eignet sich als erklärende Geste.

**Stil:** eigenständige matte 2.5D-Illustration mit großen einfachen Formen. Keine photorealistische Fellstruktur, keine kindliche Spielzeugästhetik, kein Helm, keine Brille oder austauschbare Lupe. Die Silhouette muss auch verkleinert noch als Fenn funktionieren.

Kein Duolingo-Vogel, kein Firefox-Globus, kein orange-roter Schweifkreis. Die Referenz Duolingo betrifft die konsistente Begleiterrolle, nicht die Übernahme ihrer Figur oder ihrer Druck-/Streakmechanik.

### Unterschied zwischen Figur und Logo

- **Maskottchen:** ausdrucksstarke Illustration für Begrüßung, Erklärungen und wichtige Zustände.
- **App-Icon/Signet:** später ein separat gezeichneter einfacher Fenn-Kopf mit zwei charakteristischen Ohren; muss in kleinen Größen funktionieren.
- **Wortmarke:** klarer Text SiteFenn; kein KI-generiertes Rasterbild als einzige Textdarstellung.

Der erste generierte Charakter ist ein Ankerentwurf, kein bereits fertiges Animationspaket, Vektorlogo oder Favicon. Diese Ausarbeitungen folgen erst nach Zustimmung zur Identität.

## 3. Persönlichkeit und Sprache

Fenn ist ein konzentrierter, freundlicher technischer Begleiter. Er hilft beim Einordnen und zeigt den nächsten Schritt. Er ist weder Richter noch allwissender SEO-Guru.

Grundregeln:

- Du-Ansprache, kurze Sätze, klare Begriffe.
- Zuerst Beobachtung, dann Bedeutung, dann nächste Aktion.
- Messung, Vermutung und Empfehlung ausdrücklich unterscheiden.
- Keine erfundenen Zahlen, Ursachen, Fundstellen oder Erfolgsgarantien.
- Keine Scham, Drohungen oder traurige Figur, weil jemand die App nicht geöffnet hat.
- Lob nur für tatsächliche Ergebnisse: Abhaken ist noch keine bestandene Nachprüfung.
- Technische Warnungen funktionieren auch ohne Figur und ohne Ton.

Beispiele für spätere, tatsächlich beleggebundene Erklärungen:

> „Auf Mobil verdeckt das Menü den Hauptbutton. Hier ist die Aufnahme. Prüfe zuerst das Schließverhalten des Menüs.“

> „Die Meta Description fehlt. Das ist ein technischer Hinweis, aber kein Beweis für ein Rankingproblem.“

> „Dieser Zustand wurde im zweiten Scan nicht erneut geprüft. Deshalb kann ich noch nicht bestätigen, dass der Fehler behoben ist.“

Nicht verwenden: „Ich habe alles geprüft“, „Google wird dich dafür abstrafen“, „Deine Website ist jetzt perfekt“ oder „Ich bin enttäuscht von dir“.

## 4. Rolle des lokalen LLM und der Stimme

Die Figur ist die visuelle Identität. Das LLM formuliert Erklärungen aus freigegebenen Messdaten. Eine getrennte Sprachausgabe macht diese Texte bei Bedarf hörbar. Das sind drei verschiedene Bausteine.

**Aktueller Stand 0.1:** keine Modellinferenz und keine Sprachausgabe. Ein Maskottchen darf diese Fähigkeiten nicht als bereits vorhanden darstellen.

Für die spätere Umsetzung:

1. Validierte Befunde und ausgewählte Nachweise an das lokale Modell übergeben.
2. Kurze strukturierte Erklärung mit existierenden Evidence-IDs erzeugen und prüfen.
3. Text mit Quellverweis und deutlich erkennbarer KI-Kennzeichnung anzeigen.
4. Nur auf ausdrücklichen Wunsch über eine geeignete lokale TTS-Engine vorlesen.
5. Abbrechen, stummschalten und die Figur ausblenden können.

Kein automatisch startender Ton. Kein Mikrofon für das reine Vorlesen erforderlich. Sprachdialog mit Mikrofon ist eine spätere gesonderte Funktion mit sichtbarem Aufnahmestatus und ausdrücklicher Zustimmung.

Der Name „lokal“ darf für Audio nur verwendet werden, wenn die gewählte Engine wirklich lokal verarbeitet. Keine stille Cloud-Ausweichlösung. Modell-/Stimmdateien und deren Lizenzen werden vor Verteilung geprüft. Eine konkrete TTS-Engine wird in diesem Branding-Schritt noch nicht festgelegt.

Bis eine echte Modellanfrage läuft, gibt es keine „Fenn denkt“-Animation als Simulation von KI. Statische Einführungstexte bleiben als solche erkennbar.

## 5. Geplante Avatar-Zustände

| Zustand | Darstellung | Fachliche Voraussetzung |
| --- | --- | --- |
| Bereit | Ruhig sitzen, gelegentlich optional blinzeln | Keine Aktivität behaupten. |
| Scan läuft | Aufmerksame Ohren, Blick zur Vorschau | Tatsächlich aktiver Scan-Job. |
| KI wertet aus | Dezente Denkpose mit Statusbeschriftung | Tatsächlich laufende Modellanfrage. |
| Erklären | Erhobenes Pfötchen, kurze Sprechblase | Validierter Text mit Befundbezug. |
| Manuell prüfen | Nachdenklich, neutral | Unbestätigte Hypothese, kein bewiesener Fehler. |
| Fix bestätigt | Kleine zufriedene Geste | Passender erneuter Test bestanden. |
| Fehler/Unterbrechung | Ruhig unterstützend | Klare technische Meldung und nächste Aktion. |

Vorerst Zustandskonzept, keine fertigen sieben Bilddateien. Mundbewegung später nur bei tatsächlicher Audioausgabe. Reduzierte Bewegung deaktiviert Animationen; Text und Status bleiben vollständig bedienbar.

## 6. Visuelle Corporate Identity

**Richtung:** ruhiges Developer-Werkzeug mit warmer Persönlichkeit. Die bisherige dunkle Oberfläche ist ein guter Ausgangspunkt. Fenn bringt Wärme, nicht eine zweite konkurrierende Spieloberfläche.

| Token | Farbe | Verwendung |
| --- | --- | --- |
| Canvas | `#101614` | Grundfläche. |
| Surface | `#18201B` | Karten und Panels. |
| Surface raised | `#202B23` | Erhöhte/aktive Flächen. |
| Text | `#F2F5EF` | Haupttext. |
| Muted | `#AAB6AA` | Sekundärtext, nicht unsichtbares Kleingedrucktes. |
| Fenn lime | `#CFF48A` | Primäre Aktion und Fokus, mit dunklem Text. |
| Teal | `#74CCB1` | Sekundäre informative Akzente. |
| Sand | `#F3D8B3` | Figur und wenige warme Markenakzente. |
| Warning | `#F4BC70` | Wichtiger Handlungsbedarf. |
| Critical | `#FF8B8B` | Bestätigte kritische Befunde. |
| Border | `#344437` | Flächentrennung, nicht alleinige Statusinformation. |

Beispielkontraste rechnerisch geprüft: Text auf Canvas etwa 16,64:1, Muted auf Surface 7,91:1 und dunkler Text auf Lime 14,79:1. Das sind einzelne Farbpaarprüfungen, keine vollständige WCAG-Prüfung des Produkts.

### Typografie und Form

- UI zunächst mit lokal verfügbarem System-Sans-Stack; keine notwendige Google-Fonts-Verbindung.
- Später optional eine lokal mitgelieferte Schrift nach Lizenzprüfung.
- Wortmarke halbfett, leicht kompakt, keine verspielten Fantasiebuchstaben.
- Größenhierarchie: Seitentitel 28–36 px, Paneltitel 18–22 px, Standardtext 14–16 px.
- 8-Pixel-Abstandsraster; 12–16 px Kartenradien; sparsame Schatten.
- Ein klarer primärer Button je Aufgabenbereich.
- Monospace für technische Fundstellen, nicht für ganze Erklärtexte.
- Diagramme und Status nie ausschließlich über Farbe unterscheiden.

Die Palette wird erst nach Freigabe als produktives Theme in die App übernommen. `tokens.proposed.json` ist ein Entwurf, keine bereits konsumierte App-Konfiguration.

## 7. Wo Fenn im Hub erscheint

1. **Onboarding/Leerzustand:** etwas größer, hilfreich erklären, wie der erste Scan beginnt.
2. **Scan-Workspace:** kompakt an einem festen Rand des Arbeitsbereichs; keine Überdeckung der geprüften Website.
3. **Befunddetail:** „Fenn erklärt“ auf Nachfrage, mit Bezug auf den ausgewählten Befund.
4. **Report:** kurze Zusammenfassung statt eines zweiten Chatverlaufs über dem Bericht.
5. **Nachtest:** bestätigte Änderungen ruhig zusammenfassen.

Kein frei schwebendes großes Haustier über Buttons. Keine ständigen Sprechblasen. Für erfahrene Nutzer muss die Figur ausblendbar bleiben, ohne Funktionen zu verlieren.

Die künftige Chat-/Erkläransicht soll nach einem ausgewählten Problem fragen können, nicht den gesamten Hub durch einen allgemeinen Chat ersetzen. Eine reine Textansicht bleibt gleichwertig.

## 8. Umsetzung vor und nach 0.2

### Vor dem Rebrand

- Name und Avatar-Richtung durch Nutzer freigeben lassen.
- Namenskollisionen, Domain-/Repository-Verfügbarkeit und Rechtefragen separat prüfen.
- Masterillustration visuell bewerten, besonders Silhouette und Wiedererkennung in kleinen Größen.

### Branding-Schritt nach Freigabe

- Konsistente Wortmarke, Signet, App-Icon und erste ausgewählte Avatar-Zustände ausarbeiten.
- Theme, App-Titel, README, Screenshots und GitHub-Beschreibung aktualisieren.
- Repository-Umbenennung nur bewusst und koordiniert durchführen.
- Bestehendes Datenverzeichnis nicht einfach umbenennen: zuerst Migrations-/Kompatibilitätsweg mit Backup festlegen. Der Markenwechsel darf keine Projekte verlieren.
- Neue Screenshots zeigen tatsächliche Funktionen; eine Designansicht wird nicht als laufende KI verkauft.

### Danach 0.2

Der nächste Funktionsschritt bleibt der begrenzte Crawler mit Seitenauswahl und nachvollziehbaren Grenzen. Fenn kann bereits statische Einführung und echte Scan-Zustände begleiten. Die lokale Modellanalyse aus dem bisherigen Plan wird dadurch nicht heimlich als fertig behandelt.

Soll Fenn bereits früher wirklich erklären/vorlesen, braucht es ein ausdrücklich vorgezogenes Arbeitspaket für Ollama-Anbindung, Ausgabeprüfung und lokale TTS. Das ist eine bewusste Roadmap-Änderung, kein Nebenprodukt eines neuen Logos.

## 9. Asset-Provenienz

Avatar-Ankerentwurf: mit dem eingebauten Bildgenerator erstellt; Prompt in `AVATAR-PROMPT.md`. Die KI-Generierung ist kein Nachweis weltweiter gestalterischer Exklusivität oder geklärter Markenrechte. Ein späteres finales Signet wird separat geprüft und für kleine Darstellungen ausgearbeitet.

Status: Entwurf. Noch keine Repository-Umbenennung, App-Integration, echte Sprachausgabe oder Version 0.2.
