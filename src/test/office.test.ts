import { describe, expect, it } from "vitest";

import { excelDate, isLegacyOffice, officeKind, officeToText } from "@/lib/office";

/** Monta um zip mínimo (compactado com deflate, como o Office faz). */
async function zip(files: Record<string, string>): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameB = enc.encode(name);
    const raw = enc.encode(content);
    const comp = new Uint8Array(await new Response(new Response(raw).body!.pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
    const local = new Uint8Array(30 + nameB.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(8, 8, true);
    lv.setUint32(18, comp.length, true); lv.setUint32(22, raw.length, true); lv.setUint16(26, nameB.length, true);
    local.set(nameB, 30);
    const cd = new Uint8Array(46 + nameB.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(10, 8, true);
    cv.setUint32(20, comp.length, true); cv.setUint32(24, raw.length, true); cv.setUint16(28, nameB.length, true); cv.setUint32(42, offset, true);
    cd.set(nameB, 46);
    parts.push(local, comp); central.push(cd);
    offset += local.length + comp.length;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, central.length, true); ev.setUint16(10, central.length, true);
  ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true);
  const all = [...parts, ...central, eocd];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let p = 0;
  for (const a of all) { out.set(a, p); p += a.length; }
  return out.buffer;
}

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

describe("documentos do Office", () => {
  it("reconhece os formatos pelo nome", () => {
    expect(officeKind("Campanha.XLSX")).toBe("xlsx");
    expect(officeKind("macro.xlsm")).toBe("xlsx");
    expect(officeKind("ata.docx")).toBe("docx");
    expect(officeKind("aula.pptx")).toBe("pptx");
    expect(officeKind("foto.png")).toBeNull();
    expect(isLegacyOffice("antiga.xls")).toBe(true);
    expect(isLegacyOffice("nova.xlsx")).toBe(false);
  });

  it("converte datas do Excel", () => {
    expect(excelDate(46338)).toBe("12/11/2026");
    expect(excelDate(46338.5)).toBe("12/11/2026 12:00");
  });

  it("planilha vira CSV: textos, números, datas, colunas vazias e várias abas", async () => {
    const buf = await zip({
      "xl/workbook.xml": `<workbook ${NS}><sheets><sheet name="Contatos" sheetId="1" r:id="rId1"/><sheet name="Resumo" sheetId="2" r:id="rId2"/></sheets></workbook>`,
      "xl/_rels/workbook.xml.rels": `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>`,
      "xl/sharedStrings.xml": `<sst ${NS}><si><t>Nome</t></si><si><t>Celular</t></si><si><r><t>Maria </t></r><r><t>Silva</t></r></si><si><t>Souza, Ana</t></si></sst>`,
      "xl/styles.xml": `<styleSheet ${NS}><numFmts><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs></styleSheet>`,
      "xl/worksheets/sheet1.xml": `<worksheet ${NS}><sheetData>
        <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="D1" t="inlineStr"><is><t>Data</t></is></c></row>
        <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>5532999990000</v></c><c r="D2" s="1"><v>46338</v></c></row>
        <row r="3"><c r="A3" t="s"><v>3</v></c><c r="B3" t="str"><v>+5532988880000</v></c></row>
        <row r="4"><c r="A4"/></row>
      </sheetData></worksheet>`,
      "xl/worksheets/sheet2.xml": `<worksheet ${NS}><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Total</t></is></c><c r="B1"><v>2</v></c><c r="C1" t="b"><v>1</v></c></row></sheetData></worksheet>`,
    });
    expect(await officeToText(buf, "xlsx")).toBe(
      "## Aba: Contatos\nNome,Celular,,Data\nMaria Silva,5532999990000,,12/11/2026\n\"Souza, Ana\",+5532988880000\n\n## Aba: Resumo\nTotal,2,VERDADEIRO",
    );
  });

  it("Word vira texto, com tabelas em linhas", async () => {
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const buf = await zip({
      "word/document.xml": `<w:document ${W}><w:body>
        <w:p><w:r><w:t>Reunião </w:t></w:r><w:r><w:t>de pauta</w:t></w:r></w:p>
        <w:tbl><w:tr><w:tc><w:p><w:r><w:t>Polo</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Prazo</w:t></w:r></w:p></w:tc></w:tr>
        <w:tr><w:tc><w:p><w:r><w:t>Centro</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>20/11</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
        <w:p><w:r><w:t>Fim</w:t><w:tab/><w:t>ok</w:t></w:r></w:p>
      </w:body></w:document>`,
    });
    expect(await officeToText(buf, "docx")).toBe("Reunião de pauta\nPolo | Prazo\nCentro | 20/11\nFim\tok");
  });

  it("PowerPoint vira texto por slide, na ordem", async () => {
    const A = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
    const slide = (t: string) => `<p:sld ${A}><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${t}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
    const buf = await zip({ "ppt/slides/slide10.xml": slide("Dez"), "ppt/slides/slide2.xml": slide("Dois") });
    expect(await officeToText(buf, "pptx")).toBe("## Slide 2\nDois\n\n## Slide 10\nDez");
  });

  it("arquivo que não é zip dá erro claro", async () => {
    await expect(officeToText(new TextEncoder().encode("não sou planilha").buffer, "xlsx")).rejects.toThrow(/não é um documento do Office/);
  });
});
