import { useState } from "react";
import CvFileManager from "./CvFileManager";
import CvBuilder from "./CvBuilder";

// Onglet "Mon CV" : en haut le CV proposé aux visiteurs, en bas le générateur
export default function CvTab() {
  // Quand le générateur publie un CV, on incrémente ce compteur
  // pour que CvFileManager relise les infos du fichier
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <>
      <CvFileManager reloadKey={reloadKey} />
      <h2 className="cv-builder-title">Générateur de CV</h2>
      <CvBuilder onPublished={() => setReloadKey((k) => k + 1)} />
    </>
  );
}
