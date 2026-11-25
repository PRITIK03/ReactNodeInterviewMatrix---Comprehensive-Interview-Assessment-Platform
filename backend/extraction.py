"""Extract only text witnessed in the document. Preserve section entries verbatim."""

import io
import re
import shutil
import subprocess
import zipfile
from typing import Literal

import pymupdf
from docx import Document
from pydantic import BaseModel, Field

PARSER = "native-sections-v1"


class Evidence(BaseModel):
    document_id: str
    page: int | None
    start: int
    end: int
    excerpt: str
    method: Literal["pdf", "docx", "ocr"]
    parser_version: str = PARSER


class Fact(BaseModel):
    value: str
    status: Literal["explicit", "ambiguous", "conflicting"] = "explicit"
    confidence: Literal["high", "review"]
    evidence: Evidence


class Contact(Fact):
    kind: Literal["email", "phone"]


class Education(Fact):
    institution: str | None = None


class Employment(Fact):
    employer: str | None = None


class Project(Fact):
    name: str | None = None


class Skill(Fact):
    proficiency: str | None = None


class Certification(Fact):
    issuer: str | None = None


class Achievement(Fact):
    award: str | None = None


class ExtractedDate(Fact):
    precision: Literal["year"] = "year"


MODELS = {
    "education": Education,
    "employment": Employment,
    "projects": Project,
    "skills": Skill,
    "certifications": Certification,
    "achievements": Achievement,
    "dates": ExtractedDate,
}


class ResumeFacts(BaseModel):
    contact: list[Contact] = Field(default_factory=list)
    education: list[Education] = Field(default_factory=list)
    employment: list[Employment] = Field(default_factory=list)
    projects: list[Project] = Field(default_factory=list)
    skills: list[Skill] = Field(default_factory=list)
    certifications: list[Certification] = Field(default_factory=list)
    achievements: list[Achievement] = Field(default_factory=list)
    dates: list[ExtractedDate] = Field(default_factory=list)


SECTIONS = {
    "education": "education",
    "work experience": "employment",
    "employment": "employment",
    "experience": "employment",
    "projects": "projects",
    "technical skills": "skills",
    "skills": "skills",
    "certifications": "certifications",
    "achievements": "achievements",
}
EMAIL = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")
DATE = re.compile(r"\b(?:19|20)\d{2}\b")
PHONE = re.compile(r"^\+?[\d\s().-]{8,20}$")


def validate_container(blob, fmt):
    if fmt == "pdf":
        if not blob.startswith(b"%PDF-"):
            raise ValueError("Invalid PDF signature")
    else:
        with zipfile.ZipFile(io.BytesIO(blob)) as z:
            entries = z.infolist()
            if len(entries) > 500 or sum(e.file_size for e in entries) > 25_000_000:
                raise ValueError("Archive limit")
            if not {"word/document.xml", "[Content_Types].xml"}.issubset(z.namelist()):
                raise ValueError("Invalid DOCX")
            if any(
                e.flag_bits & 1
                or "vbaproject" in e.filename.lower()
                or "/embeddings/" in e.filename.lower()
                for e in entries
            ):
                raise ValueError("Active or encrypted document")


def ocr(page):
    exe = shutil.which("tesseract")
    if not exe:
        raise ValueError("OCR unavailable")
    if page.rect.width * page.rect.height * 4 > 6_000_000:
        raise ValueError("OCR page too large")
    image = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=False)
    return subprocess.run(
        [exe, "stdin", "stdout", "-l", "eng"],
        input=image.tobytes("png"),
        capture_output=True,
        timeout=15,
        check=True,
    ).stdout.decode("utf8")


def extract(blob, fmt, document):
    validate_container(blob, fmt)
    pages = []
    warnings = []
    if fmt == "docx":
        d = Document(io.BytesIO(blob))
        paragraphs = [p.text for p in d.paragraphs] + [
            cell.text for table in d.tables for row in table.rows for cell in row.cells
        ]
        pages.append((None, "docx", "\n".join(paragraphs)))
    else:
        with pymupdf.open(stream=blob, filetype="pdf") as pdf:
            if pdf.needs_pass or not 1 <= len(pdf) <= 25:
                raise ValueError("Unsupported PDF")
            for i, page in enumerate(pdf):
                text = page.get_text()
                method = "pdf"
                if len(text.strip()) < 30:
                    try:
                        scanned = ocr(page)
                        if len(scanned.strip()) > len(text.strip()):
                            text, method = scanned, "ocr"
                        if not text.strip():
                            warnings.append(f"No text on page {i + 1}")
                    except (ValueError, subprocess.SubprocessError):
                        warnings.append(f"OCR unavailable on page {i + 1}")
                pages.append((i + 1, method, text))
    if sum(len(p[2]) for p in pages) > 250000:
        raise ValueError("Text limit")
    if not any(t.strip() for _, _, t in pages):
        raise ValueError("No readable text")
    result = ResumeFacts()
    section = None
    for page, method, text in pages:
        for line in re.finditer(r"[^\r\n]+", text):
            value = line.group().strip()
            if not value:
                continue
            heading = value.rstrip(":").casefold()
            if heading in SECTIONS:
                section = SECTIONS[heading]
                continue
            if heading in {
                "summary",
                "interests",
                "references",
                "languages",
                "personal information",
                "profile",
                "objective",
            }:
                section = None
                continue

            def record(field, term, offset=0, ambiguous=False):
                pos = line.start() + line.group().index(value) + offset
                evidence = Evidence(
                    document_id=document,
                    page=page,
                    start=pos,
                    end=pos + len(term),
                    excerpt=term,
                    method=method,
                )
                attrs = dict(
                    value=term,
                    status="ambiguous" if ambiguous else "explicit",
                    confidence="review" if ambiguous or method == "ocr" else "high",
                    evidence=evidence,
                )
                if field == "contact":
                    fact = Contact(
                        **attrs, kind="email" if EMAIL.fullmatch(term) else "phone"
                    )
                else:
                    fact = MODELS[field](**attrs)
                getattr(result, field).append(fact)

            emails = list(EMAIL.finditer(value))
            for m in emails:
                record("contact", m.group(), m.start())
            if PHONE.fullmatch(value) and sum(ch.isdigit() for ch in value) >= 8:
                record("contact", value)
            elif section and not emails:
                record(section, value)
            years = list(DATE.finditer(value))
            for m in years:
                record("dates", m.group(), m.start(), True)
            if (
                len(years) == 2
                and re.fullmatch(
                    r"\s*(?:-|–|to)\s*", value[years[0].end() : years[1].start()]
                )
                and years[0].group() > years[1].group()
            ):
                for f in result.dates[-2:]:
                    f.status = "conflicting"
                warnings.append(
                    "Date range is reversed; reviewer confirmation required."
                )
    if len({f.value for f in result.contact if EMAIL.fullmatch(f.value)}) > 1:
        warnings.append("Multiple contact addresses; confirm preferred address")
        for fact in result.contact:
            fact.status = "ambiguous"
            fact.confidence = "review"
    missing = [k for k in ResumeFacts.model_fields if not getattr(result, k)]
    if missing:
        warnings.append("No explicit evidence for " + ", ".join(missing))
    if not any(getattr(result, k) for k in ResumeFacts.model_fields):
        warnings.append("No recognized sections; manual review required")
    return result.model_dump(), warnings
