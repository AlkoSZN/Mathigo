# Validation SymPy des exercices générés par generate.js.
# Usage : python scripts/generation/validate.py [out/ana1-xxx.json ...]
#   Sans argument : valide tous les fichiers de scripts/generation/out/.
# Sorties :
#   scripts/generation/validated/<skill_id>.json  (exercices acceptés, prêts pour insert.js)
#   scripts/generation/rejected.jsonl             (exercices rejetés + motif, pour revue)

import json
import re
import sys
from pathlib import Path

import sympy
from sympy import (
    E, Abs, FiniteSet, Interval, Rational, Sum, Union, cos, diff, exp,
    factorial, integrate, limit, log, oo, pi, simplify, sin, sqrt, symbols, tan,
)
from sympy.sets.sets import Set

RACINE = Path(__file__).resolve().parent
DOSSIER_OUT = RACINE / "out"
DOSSIER_VALIDE = RACINE / "validated"
FICHIER_REJETS = RACINE / "rejected.jsonl"

x, n = symbols("x n")

# Espace de noms fermé pour sympify : uniquement ce que le prompt autorise.
ESPACE = {
    "x": x, "n": n,
    "exp": exp, "log": log, "ln": log, "sqrt": sqrt,
    "sin": sin, "cos": cos, "tan": tan, "Abs": Abs,
    "pi": pi, "oo": oo, "E": E,
    "Rational": Rational, "factorial": factorial,
    # réponses ensemblistes (image d'un segment, ensembles de solutions)
    "Interval": Interval, "Union": Union, "FiniteSet": FiniteSet,
    # autorisés uniquement dans expected_sympy, inoffensifs dans les choix
    "diff": diff, "limit": limit, "Sum": Sum, "integrate": integrate,
    "solveset": sympy.solveset, "imageset": sympy.imageset,
}

ERREURS_TYPES_REQUIS = 3  # nombre de distracteurs devant porter un error_type

RE_DELIMITEURS_DOLLAR = re.compile(r"^(\${1,2})([\s\S]*)\1$")


def nettoyer_delimiteurs(latex):
    """Retire un $...$ ou $$...$$ englobant : choices[].latex attend du LaTeX
    nu (rendu direct par KaTeX), pas des délimiteurs Markdown-style — sinon le
    "$" littéral casse le parsing et KaTeX affiche la source brute en rouge."""
    m = RE_DELIMITEURS_DOLLAR.match(latex.strip())
    return m.group(2).strip() if m else latex


def parser(expression):
    """Parse une expression SymPy dans l'espace de noms fermé."""
    return sympy.sympify(expression, locals=ESPACE, evaluate=True)


def egaux(a, b):
    """Égalité symbolique robuste : ensembles, puis equals(), puis simplify."""
    est_ensemble_a = isinstance(a, Set)
    est_ensemble_b = isinstance(b, Set)
    if est_ensemble_a != est_ensemble_b:
        return False
    if est_ensemble_a:
        if a == b:
            return True
        try:
            return a.symmetric_difference(b).is_empty is True
        except Exception:
            return False
    try:
        r = a.equals(b)
        if r is not None:
            return r
    except Exception:
        pass
    try:
        return simplify(a - b) == 0
    except Exception:
        return False


def valider_exercice(ex):
    """Renvoie (verdict, motif) : verdict 'auto', 'manual' ou None si rejet."""
    if len(ex.get("hints", [])) != 2:
        return None, "il faut exactement 2 indices"
    if not ex.get("statement_latex") or not ex.get("solution_latex"):
        return None, "énoncé ou solution vide"
    if not isinstance(ex.get("difficulty"), int) or not 1 <= ex["difficulty"] <= 5:
        return None, "difficulty hors de [1, 5]"

    fmt = ex.get("format", "qcm")
    if fmt == "remise_en_ordre":
        return valider_remise_en_ordre(ex)
    if fmt not in ("qcm", "qcm_theorique"):
        return None, f"format inconnu : {fmt}"

    choix = ex.get("choices", [])
    if len(choix) != 4:
        return None, f"{len(choix)} choix au lieu de 4"
    if not all(isinstance(c, dict) and isinstance(c.get("latex"), str) for c in choix):
        return None, "choix mal formé (objet {latex, correct, ...} attendu)"
    for c in choix:
        c["latex"] = nettoyer_delimiteurs(c["latex"])
    corrects = [c for c in choix if c.get("correct") is True]
    if len(corrects) != 1:
        return None, f"{len(corrects)} choix corrects au lieu de 1"
    incorrects = [c for c in choix if not c.get("correct")]
    if sum(1 for c in incorrects if c.get("error_type")) < ERREURS_TYPES_REQUIS:
        return None, "error_type manquant sur un distracteur"

    # Unicité visuelle : deux choix affichant le même LaTeX rendent le QCM ambigu
    for i in range(4):
        for j in range(i + 1, 4):
            li = choix[i]["latex"].replace("$", "").replace(" ", "")
            lj = choix[j]["latex"].replace("$", "").replace(" ", "")
            if li == lj:
                return None, f"deux choix affichent le même LaTeX : {choix[i]['latex']}"

    check = ex.get("check") or {}
    if ex.get("format", "qcm") == "qcm_theorique" or check.get("kind") != "value":
        # Question de cours / conceptuelle : les champs sympy n'ont pas de sens,
        # l'exercice part en file de relecture humaine.
        return "manual", None

    # Parse des 4 choix
    exprs = []
    for c in choix:
        try:
            exprs.append(parser(c["sympy"]))
        except Exception as err:
            return None, f"sympy imparsable « {c.get('sympy')} » : {err}"

    bonne = exprs[choix.index(corrects[0])]

    # Unicité symbolique : un distracteur égal à la bonne réponse (ou à un
    # autre distracteur) est un distracteur raté.
    for i in range(4):
        for j in range(i + 1, 4):
            if egaux(exprs[i], exprs[j]):
                return None, (
                    f"deux choix symboliquement égaux : {choix[i]['latex']} et {choix[j]['latex']}"
                )

    try:
        attendu = parser(check["expected_sympy"])
        attendu = attendu.doit() if hasattr(attendu, "doit") else attendu
    except Exception as err:
        return None, f"expected_sympy imparsable : {err}"
    if not egaux(attendu, bonne):
        return None, (
            f"la réponse recalculée {attendu} ne correspond pas au choix correct {bonne}"
        )
    return "auto", None


def valider_remise_en_ordre(ex):
    """Contrôles structurels d'une remise en ordre (toujours validation manual)."""
    fragments = ex.get("fragments", [])
    distracteurs = ex.get("distracteurs", [])
    if not 3 <= len(fragments) <= 8:
        return None, f"{len(fragments)} fragments (attendu 3 à 8)"
    if len(distracteurs) > 3:
        return None, f"{len(distracteurs)} distracteurs (maximum 3)"
    tous = fragments + distracteurs
    if any(not isinstance(f, str) or not f.strip() for f in tous):
        return None, "fragment vide ou non textuel"
    normalises = [f.replace("$", "").replace(" ", "") for f in tous]
    if len(set(normalises)) != len(normalises):
        return None, "fragments ou distracteurs en double"
    return "manual", None


def valider_fichier(chemin, rejets):
    donnees = json.loads(chemin.read_text(encoding="utf-8"))
    skill_id = donnees["skill_id"]
    acceptes = []
    for ex in donnees["exercises"]:
        verdict, motif = valider_exercice(ex)
        if verdict is None:
            rejets.append({"skill_id": skill_id, "motif": motif, "exercise": ex})
            continue
        acceptes.append(
            {
                "skill_id": skill_id,
                "difficulty": ex["difficulty"],
                "validation": verdict,
                "payload": ex,
            }
        )
    sortie = DOSSIER_VALIDE / f"{skill_id}.json"
    sortie.write_text(json.dumps(acceptes, ensure_ascii=False, indent=2), encoding="utf-8")
    n_auto = sum(1 for e in acceptes if e["validation"] == "auto")
    n_manuel = len(acceptes) - n_auto
    print(
        f"{skill_id} : {len(acceptes)} acceptés ({n_auto} auto, {n_manuel} manual), "
        f"{len(donnees['exercises']) - len(acceptes)} rejetés"
    )


def principal():
    DOSSIER_VALIDE.mkdir(exist_ok=True)
    fichiers = [Path(a) for a in sys.argv[1:]] or sorted(DOSSIER_OUT.glob("*.json"))
    if not fichiers:
        raise SystemExit("aucun fichier à valider dans scripts/generation/out/")
    rejets = []
    for chemin in fichiers:
        valider_fichier(chemin, rejets)
    if rejets:
        with FICHIER_REJETS.open("a", encoding="utf-8") as f:
            for r in rejets:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(f"{len(rejets)} rejet(s) ajoutés à rejected.jsonl")


if __name__ == "__main__":
    principal()
