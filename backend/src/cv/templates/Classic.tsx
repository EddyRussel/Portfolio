import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CvData } from "../types.js";
import { contactItems, period, skillGroups } from "../format.js";

// ---------------------------------------------------------------------------
// Gabarit "Classique" : une colonne, police à empattements (Times),
// sobre et traditionnel. Idéal pour les candidatures "formelles".
// ---------------------------------------------------------------------------
const INK = "#1d1d1f";
const MUTED = "#55555a";

const s = StyleSheet.create({
  page: {
    paddingVertical: 40,
    paddingHorizontal: 48,
    fontFamily: "Times-Roman",
    fontSize: 10.5,
    color: INK,
    lineHeight: 1.35,
  },
  name: {
    fontFamily: "Times-Bold",
    fontSize: 24,
    lineHeight: 1.2,
    textAlign: "center",
  },
  headline: { fontSize: 12, textAlign: "center", color: MUTED, marginTop: 3 },
  contact: { fontSize: 9.5, textAlign: "center", color: MUTED, marginTop: 6 },
  section: { marginTop: 14 },
  sectionTitle: {
    fontFamily: "Times-Bold",
    lineHeight: 1.3,
    fontSize: 12,
    letterSpacing: 0.6,
    borderBottomWidth: 0.8,
    borderBottomColor: INK,
    paddingBottom: 2,
    marginBottom: 6,
  },
  entry: { marginBottom: 7 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  entryTitle: { fontFamily: "Times-Bold", fontSize: 11 },
  entryDate: { fontSize: 9.5, color: MUTED },
  entryWhere: { fontFamily: "Times-Italic", color: MUTED },
  text: { marginTop: 2 },
  skillLine: { marginBottom: 2 },
  bold: { fontFamily: "Times-Bold" },
});

export default function Classic({ data }: { data: CvData }) {
  return (
    <Document title={`CV – ${data.full_name}`} author={data.full_name}>
      <Page size="LETTER" style={s.page}>
        <Text style={s.name}>{data.full_name}</Text>
        {data.headline && <Text style={s.headline}>{data.headline}</Text>}
        <Text style={s.contact}>{contactItems(data).join("  |  ")}</Text>

        {data.bio && (
          <View style={s.section}>
            <Text style={s.sectionTitle} minPresenceAhead={40}>
              Profil
            </Text>
            <Text>{data.bio}</Text>
          </View>
        )}

        {data.skills.length > 0 && (
          <View style={s.section} wrap={false}>
            <Text style={s.sectionTitle} minPresenceAhead={40}>
              Compétences
            </Text>
            {skillGroups(data.skills).map((group) => (
              <Text key={group.label} style={s.skillLine}>
                <Text style={s.bold}>{group.label} : </Text>
                {group.skills.map((sk) => sk.name).join(", ")}
              </Text>
            ))}
          </View>
        )}

        {data.experiences.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle} minPresenceAhead={40}>
              Expériences
            </Text>
            {data.experiences.map((exp) => (
              // wrap={false} : une expérience n'est jamais coupée entre deux pages
              <View key={exp.id} style={s.entry} wrap={false}>
                <View style={s.row}>
                  <Text style={s.entryTitle}>{exp.position}</Text>
                  <Text style={s.entryDate}>
                    {period(exp.start_date, exp.end_date)}
                  </Text>
                </View>
                <Text style={s.entryWhere}>{exp.company}</Text>
                {exp.description && (
                  <Text style={s.text}>{exp.description}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {data.projects.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle} minPresenceAhead={40}>
              Projets
            </Text>
            {data.projects.map((project) => (
              <View key={project.id} style={s.entry} wrap={false}>
                <Text style={s.entryTitle}>{project.title}</Text>
                {project.technologies && project.technologies.length > 0 && (
                  <Text style={s.entryWhere}>
                    {project.technologies.join(", ")}
                  </Text>
                )}
                {project.description && (
                  <Text style={s.text}>{project.description}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {data.education.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle} minPresenceAhead={40}>
              Formations et certifications
            </Text>
            {data.education.map((edu) => (
              <View key={edu.id} style={s.entry} wrap={false}>
                <View style={s.row}>
                  <Text style={s.entryTitle}>{edu.degree}</Text>
                  <Text style={s.entryDate}>
                    {period(edu.start_date, edu.end_date)}
                  </Text>
                </View>
                <Text style={s.entryWhere}>{edu.school}</Text>
                {edu.description && (
                  <Text style={s.text}>{edu.description}</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
