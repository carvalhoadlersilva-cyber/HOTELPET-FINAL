/* ==========================================================================
   filtros.js  -  Semana 2: Buscas e Filtros Dinâmicos em Tabelas
   --------------------------------------------------------------------------
   Função genérica: Filtros.iniciar({ form, tabela, regras })

   - form:    seletor CSS do formulário de pesquisa      (ex.: '#form-filtros')
   - tabela:  seletor CSS da <table> a filtrar           (ex.: '#tabela-reservas')
   - regras:  lista que liga cada campo do form a uma coluna da tabela:
        { campo: 'nome do input (atributo name)', coluna: índice (0 = primeira),
          tipo: 'contem' | 'exato' | 'data-min' | 'data-max' }

   Tipos:
     contem   -> texto digitado está contido na célula (ignora maiúsc./acentos)
     exato    -> célula é igual ao valor (use em <select>: "ativo" ≠ "inativo")
     data-min -> data da célula >= data do input   (célula em dd/mm/aaaa)
     data-max -> data da célula <= data do input

   Uso: <script src="js/filtros.js" defer></script> + um <script> de configuração
   no fim de cada página de listagem. Na Semana 3, chame Tabelas.montar(...)
   ANTES de Filtros.iniciar(...), para as linhas já existirem.
   ========================================================================== */
const Filtros = (function () {
  'use strict';

  // Guarda cada filtro iniciado, pelo seletor da tabela. A Semana 3 redesenha o
  // <tbody> (inserir/excluir/mudar status) e chama Filtros.reaplicar(seletor).
  const instancias = {};

  /* ---------- Utilitários ---------- */

  // "Pastor Alemão " -> "pastor alemao"
  const normalizar = (texto) =>
    (texto ?? '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove acentos
      .toLowerCase()
      .trim();

  // "20/08/2026" -> "2026-08-20" (mesmo formato do <input type="date">,
  // e strings ISO podem ser comparadas com <, >, <=, >= direto)
  function dataParaISO(texto) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((texto ?? '').trim());
    return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
  }

  /* ---------- Regras de comparação ---------- */
  const comparadores = {
    contem: (celula, valor) => normalizar(celula).includes(normalizar(valor)),
    exato: (celula, valor) => normalizar(celula) === normalizar(valor),
    'data-min': (celula, valor) => {
      const data = dataParaISO(celula);
      return data !== '' && data >= valor;
    },
    'data-max': (celula, valor) => {
      const data = dataParaISO(celula);
      return data !== '' && data <= valor;
    }
  };

  /* ---------- Função principal ---------- */
  function iniciar({ form, tabela, regras }) {
    const elForm = document.querySelector(form);
    const elTabela = document.querySelector(tabela);

    if (!elForm || !elTabela) {
      console.warn('[Filtros] Formulário ou tabela não encontrados:', form, tabela);
      return;
    }

    const corpo = elTabela.tBodies[0];
    const totalColunas = elTabela.tHead.rows[0].cells.length;

    // Linha "Nenhum resultado" criada uma única vez
    const linhaVazia = document.createElement('tr');
    linhaVazia.className = 'sem-resultado';
    linhaVazia.style.display = 'none';
    linhaVazia.innerHTML =
      `<td colspan="${totalColunas}" style="text-align:center; color: var(--rotulo);">` +
      'Nenhum registro encontrado.</td>';
    corpo.appendChild(linhaVazia);

    function aplicar() {
      // Se o tbody foi redesenhado, a linha "Nenhum registro" saiu do DOM: recoloca
      if (!linhaVazia.isConnected) corpo.appendChild(linhaVazia);

      // Lê os valores atuais dos campos (só os que têm algo preenchido)
      const ativos = regras
        .map((regra) => {
          const campo = elForm.elements[regra.campo];
          return { ...regra, valor: campo ? campo.value.trim() : '' };
        })
        .filter((regra) => regra.valor !== '');

      const linhas = corpo.querySelectorAll('tr:not(.sem-resultado)');
      let visiveis = 0;

      linhas.forEach((linha) => {
        // A linha só aparece se passar em TODAS as regras ativas (AND)
        const passa = ativos.every((regra) => {
          const celula = linha.cells[regra.coluna];
          return celula ? comparadores[regra.tipo](celula.textContent, regra.valor) : false;
        });

        linha.style.display = passa ? '' : 'none';
        if (passa) visiveis++;
      });

      linhaVazia.style.display = visiveis === 0 ? '' : 'none';
    }

    // Tempo real: 'input' cobre digitação; 'change' cobre <select> e datas
    elForm.addEventListener('input', aplicar);
    elForm.addEventListener('change', aplicar);

    // Botão "Pesquisar": não recarrega a página, só refiltra
    elForm.addEventListener('submit', (evento) => {
      evento.preventDefault();
      aplicar();
    });

    // Botão "Limpar": o reset zera os campos DEPOIS do evento, então esperamos 0ms
    elForm.addEventListener('reset', () => setTimeout(aplicar, 0));

    instancias[tabela] = { aplicar };
    aplicar();
  }

  // Refiltra uma tabela já iniciada (ex.: Filtros.reaplicar('#tabela-reservas'))
  function reaplicar(tabela) {
    if (instancias[tabela]) instancias[tabela].aplicar();
  }

  return { iniciar, reaplicar, normalizar };
})();
