import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CvData } from "../types.js";
import { contactItems, languageLevel, period, skillGroups } from "../format.js";

// ---------------------------------------------------------------------------
// Gabarit "Moderne" : deux colonnes. À gauche une bande colorée
// (contact, compétences, langues), à droite le parcours.
// Reprend les couleurs du portfolio (bleu nuit + ambre).
// ---------------------------------------------------------------------------
const NIGHT = "#0f1424";
const AMBER = "#d9971f";
const INK = "#1c2230";
const MUTED = "#5d6576";
const SIDE_TEXT = "#e8ebf4";
const SIDE_MUTED = "#a5aec6";

const s = StyleSheet.create({
  // paddingVertical sur la page : chaque page (même la 2e) a une marge en haut et en bas
  page: { flexDirection: "row", paddingVertical: 36, fontFamily: "Helvetica", fontSize: 9.5, color: INK, lineHeight: 1.4 },
  // La bande de gauche se répète sur chaque page (fixed) et occupe toute la hauteur
  sideBg: { position: "absolute", top: 0, bottom: 0, left: 0, width: 190, backgroundColor: NIGHT },
  side: { width: 190, paddingHorizontal: 20, color: SIDE_TEXT },
  main: { flex: 1, paddingHorizontal: 28 },
  name: { fontFamily: "Helvetica-Bold", fontSize: 20, lineHeight: 1.15, color: SIDE_TEXT },
  headline: { marginTop: 6, color: AMBER, fontSize: 10 },
  sideTitle: { fontFamily: "Helvetica-Bold", fontSize: 10, color: AMBER, marginTop: 20, marginBottom: 6 },
  sideItem: { color: SIDE_TEXT, marginBottom: 3, fontSize: 8.8 },
  sideGroup: { color: SIDE_MUTED, fontSize: 8, marginTop: 6, marginBottom: 2 },
  tagRow: { flexDirection: "row", flexWrap: "wrap" },
  tag: { fontSize: 8, color: SIDE_TEXT, borderWidth: 0.6, borderColor: "#3a4566", borderRadius: 3, paddingVertical: 1.5, paddingHorizontal: 4, marginRight: 3, marginBottom: 3 },
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 12, color: NIGHT, marginBottom: 8, marginTop: 16 },
  bar: { width: 22, height: 2.5, backgroundColor: AMBER, marginBottom: 3 },
  entry: { marginBottom: 9, paddingLeft: 10, borderLeftWidth: 1.2, borderLeftColor: "#d6dae3" },
  entryTitle: { fontFamily: "Helvetica-Bold", fontSize: 10.2 },
  entryMeta: { color: MUTED, fontSize: 8.8, marginTop: 1 },
  date: { color: AMBER, fontFamily: "Helvetica-Bold", fontSize: 8.3 },
  text: { marginTop: 3 },
});

function SectionTitle({ children, first }: { children: string; first?: boolean }) {
  return (
    // minPresenceAhead : si moins de 60 points de contenu tiennent après le titre,
    // on passe à la page suivante (pas de titre tout seul en bas de page)
    <View wrap={false} minPresenceAhead={60}>
      <View style={[s.bar, first ? { marginTop: 0 } : { marginTop: 16 }]} />
      <Text style={[s.sectionTitle, { marginTop: 0 }]}>{children}</Text>
    </View>
  );
}

export default function Modern({ data }: { data: CvData }) {
  const groups = skillGroups(data.skills.filter((sk) => sk.category !== "langue"));
  const languages = data.skills.filter((sk) => sk.category === "langue");
  let first = true; // le premier titre de la colonne principale n'a pas de marge en haut
  const isFirst = () => {
    const value = first;
    first = false;
    return value;
  };

  return (
    <Document title={`CV – ${data.full_name}`} author={data.full_name}>
      <Page size="LETTER" style={s.page}>
        <View style={s.sideBg} fixed />

        {/* ---------- Colonne de gauche ---------- */}
        <View style={s.side}>
          <Text style={s.name}>{data.full_name}</Text>
          {data.headline && <Text style={s.headline}>{data.headline}</Text>}

          <Text style={s.sideTitle}>Contact</Text>
          {contactItems(data).map((item) => (
            <Text key={item} style={s.sideItem}>
              {item}
            </Text>
          ))}

          {groups.length > 0 && <Text style={s.sideTitle}>Compétences</Text>}
          {groups.map((group) => (
            <View key={group.label} wrap={false}>
              <Text style={s.sideGroup}>{group.label}</Text>
              <View style={s.tagRow}>
                {group.skills.map((sk) => (
                  <Text key={sk.id} style={s.tag}>
                    {sk.name}
                  </Text>
                ))}
              </View>
            </View>
          ))}

          {languages.length > 0 && <Text style={s.sideTitle}>Langues</Text>}
          {languages.map((lang) => (
            <Text key={lang.id} style={s.sideItem}>
              {lang.name}
              {lang.level && !lang.name.includes("(") ? ` – ${languageLevel(lang.level)}` : ""}
            </Text>
          ))}
        </View>

        {/* ---------- Colonne principale ---------- */}
        <View style={s.main}>
          {data.bio && (
            <View>
              <SectionTitle first={isFirst()}>Profil</SectionTitle>
              <Text>{data.bio}</Text>
            </View>
          )}

          {data.experiences.length > 0 && (
            <View>
              <SectionTitle first={isFirst()}>Expériences</SectionTitle>
              {data.experiences.map((exp) => (
                <View key={exp.id} style={s.entry} wrap={false}>
                  <Text style={s.date}>{period(exp.start_date, exp.end_date)}</Text>
                  <Text style={s.entryTitle}>{exp.position}</Text>
                  <Text style={s.entryMeta}>{exp.company}</Text>
                  {exp.description && <Text style={s.text}>{exp.description}</Text>}
                </View>
              ))}
            </View>
          )}

          {data.projects.length > 0 && (
            <View>
              <SectionTitle first={isFirst()}>Projets</SectionTitle>
              {data.projects.map((project) => (
                <View key={project.id} style={s.entry} wrap={false}>
                  <Text style={s.entryTitle}>{project.title}</Text>
                  {project.technologies && project.technologies.length > 0 && (
                    <Text style={s.entryMeta}>{project.technologies.join(" · ")}</Text>
                  )}
                  {project.description && <Text style={s.text}>{project.description}</Text>}
                </View>
              ))}
            </View>
          )}

          {data.education.length > 0 && (
            <View>
              <SectionTitle first={isFirst()}>Formations et certifications</SectionTitle>
              {data.education.map((edu) => (
                <View key={edu.id} style={s.entry} wrap={false}>
                  <Text style={s.date}>{period(edu.start_date, edu.end_date)}</Text>
                  <Text style={s.entryTitle}>{edu.degree}</Text>
                  <Text style={s.entryMeta}>{edu.school}</Text>
                  {edu.description && <Text style={s.text}>{edu.description}</Text>}
                </View>
              ))}
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
}
