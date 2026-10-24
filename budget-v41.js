// Domain initializer. Shared state and rendering hooks are explicit dependencies.
export function initialize(runtime) {
  /* Visible version, guided reconciliation, reusable imports and recovery tools. */
  (() => {
    const $ = (id) => document.getElementById(id),
      n = (tag, text, cls) => {
        const e = document.createElement(tag);
        if (text !== undefined) e.textContent = text;
        if (cls) e.className = cls;
        return e;
      },
      b = (text, fn, cls = "v4-button") => {
        const e = n("button", text, cls);
        e.type = "button";
        e.onclick = fn;
        return e;
      },
      field = (text, input) => {
        const e = n("label", text);
        e.append(input);
        return e;
      };
    const cash = (c) =>
      (c / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
    let current = null,
      searchTicket = 0,
      bankTicket = 0,
      timer;
    async function request(url, data) {
      const r = await fetch(
          url,
          data === undefined
            ? {}
            : {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
              },
        ),
        out = await r.json();
      if (!r.ok) throw Error(out.error || "Opération impossible.");
      return out;
    }
    window.budgetOpenBankCheck = (id) => {
      bankAccount.value = String(id);
      bankTicket++;
      bankError.textContent = "";
      bankResult.replaceChildren();
      bankBalance.value = "";
      bankContext();
      bank.d.showModal();
      bankBalance.focus();
    };
    const nav = (key) =>
      document.querySelector(`.app-shell-nav [data-view="${key}"]`).click();
    function dialog(id, title) {
      const d = n("dialog", undefined, "v41-dialog editor-dialog");
      d.id = id;
      const inner = n("div", undefined, "dialog-inner"),
        head = n("div", undefined, "dialog-heading");
      head.append(
        n("h2", title),
        b("Fermer", () => d.close(), "secondary"),
      );
      inner.append(head);
      d.append(inner);
      document.body.append(d);
      return { d, inner };
    }
    const tools = n("div", undefined, "v41-header-tools"),
      version = n("span", "…", "v41-version");
    version.id = "app-version";
    const undoButton = b(
      "Annuler la dernière modification",
      openUndo,
      "v41-header-action",
    );
    undoButton.id = "v41-undo";
    undoButton.disabled = true;
    const reloadInterface = b(
      "Recharger l’interface mise à jour",
      () => location.reload(),
      "secondary",
    );
    reloadInterface.id = "v12-reload-interface";
    reloadInterface.hidden = true;
    const versionFooter = n("div", undefined, "app-nav-footer");
    versionFooter.append(version, reloadInterface);
    document.querySelector(".app-shell-nav").append(versionFooter);
    tools.append(
      b("Rechercher…", openSearch, "v41-header-action"),
      undoButton,
      document.querySelector(".privacy-badge"),
    );
    document.querySelector(".workspace-header").append(tools);
    const search = dialog("v41-search", "Rechercher dans votre budget"),
      searchInput = n("input"),
      searchStatus = n("p", undefined, "v4-footnote"),
      searchResults = n("div", undefined, "v41-search-results");
    searchInput.type = "search";
    searchInput.placeholder = "Compte, facture, enveloppe, transaction…";
    searchInput.id = "v41-search-input";
    searchStatus.setAttribute("role", "status");
    search.inner.append(
      field("Rechercher partout", searchInput),
      searchStatus,
      searchResults,
    );
    function openSearch() {
      search.d.showModal();
      searchInput.focus();
    }
    document.addEventListener("keydown", (e) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "k" &&
        !document.querySelector("dialog[open]")
      ) {
        e.preventDefault();
        openSearch();
      }
    });
    searchInput.oninput = () => {
      clearTimeout(timer);
      const ticket = ++searchTicket,
        term = searchInput.value.trim();
      searchResults.replaceChildren();
      searchStatus.textContent =
        term.length < 2 ? "Entrez au moins deux caractères." : "Recherche…";
      if (term.length < 2) return;
      timer = setTimeout(async () => {
        try {
          const out = await request(
            "/api/support/search?q=" + encodeURIComponent(term),
          );
          if (ticket !== searchTicket) return;
          searchStatus.textContent =
            out.results.length + " résultat(s) · jusqu’à 15 par type";
          for (const r of out.results) {
            const row = b(
              "",
              () => {
                search.d.close();
                const free =
                  r.kind === "Enveloppe" &&
                  current.free_budgets?.items.some((e) => e.id === r.id);
                nav(free ? "budgets-libres" : r.route);
                if (r.kind === "Transaction" || r.kind === "Virement")
                  window.budgetEditRecord(
                    r.kind === "Virement" ? "transfer" : "transaction",
                    r.record,
                  );
                else if (r.kind === "Compte") runtime.editAccount(r.id);
                else if (r.kind === "Enveloppe") {
                  if (free) window.budgetEditFreeBudget(r.id);
                  else runtime.editEnvelope(r.id);
                } else if (r.kind === "Récurrence") runtime.editRule(r.id);
              },
              "v41-search-row",
            );
            const copy = n("span");
            copy.append(
              n("strong", r.name),
              n("small", r.kind + (r.date ? " · " + r.date : "")),
            );
            row.append(
              copy,
              n("span", r.amount_cents === null ? "" : cash(r.amount_cents)),
            );
            searchResults.append(row);
          }
        } catch (e) {
          if (ticket === searchTicket) searchStatus.textContent = e.message;
        }
      }, 200);
    };
    const undo = dialog("v41-undo-dialog", "Annuler la dernière modification"),
      undoCopy = n("p", undefined, "v4-footnote"),
      undoError = n("p", undefined, "v4-error"),
      undoConfirm = b(
        "Confirmer l’annulation",
        async () => {
          undoConfirm.disabled = true;
          undoError.textContent = "";
          try {
            const s = await request("/api/support/undo", {
              token: undoConfirm.dataset.token,
            });
            runtime.render(s);
            undo.d.close();
          } catch (e) {
            undoError.textContent = e.message;
          } finally {
            undoConfirm.disabled = false;
          }
        },
        "v4-button v4-primary",
      );
    undoError.setAttribute("role", "alert");
    undo.inner.append(undoCopy, undoError, undoConfirm);
    function openUndo() {
      const u = current?.support41?.undo;
      if (!u?.available) return;
      undoCopy.textContent =
        "Dernière action : " +
        ({
          "/api/budget/start-apply": "réglage du mois de démarrage",
          "/api/workspace/bulk-apply": "classement groupé des transactions",
          "/api/workspace/split-apply": "division d’un achat",
          "/api/banking/apply": "configuration des comptes de dépenses",
          "/api/budget/copy": "reprise des objectifs du mois précédent",
          "/api/budget/apply": "mise à jour du budget mensuel",
          "/api/budget/recurring-link": "classement d’une récurrence",
          "/api/support/checkpoint": "validation d’un rapprochement bancaire",
          "/api/categories/delete-all": "suppression de toutes les catégories",
          "/api/categories/delete": "suppression d’une catégorie",
          "/api/categories/merge": "fusion de catégories",
          "/api/categories/archive":
            "archivage ou réactivation d’une catégorie",
          "/api/subcategories": "création d’une sous-catégorie",
          "/api/subcategories/update": "renommage d’une sous-catégorie",
          "/api/subcategories/archive":
            "archivage ou réactivation d’une sous-catégorie",
          "/api/envelope-tools/apply": "configuration guidée des enveloppes",
          "/api/categories/update": "changement du nom d’une catégorie",
          "/api/transactions": "ajout d’une transaction",
          "/api/transactions/update": "modification d’une transaction",
          "/api/transactions/delete": "suppression d’une transaction",
          "/api/transfers": "ajout d’un virement",
          "/api/transfers/delete": "suppression d’un virement",
          "/api/import/commit": "import CSV",
          "/api/balance/reconcile": "correction de solde",
          "/api/planning/action": "mise à jour d’une échéance",
          "/api/free-budgets/fund": "répartition dans un budget libre",
          "/api/free-budgets/starter": "création des budgets libres",
          "/api/free-budgets/create": "création d’un budget libre",
          "/api/free-budgets/adopt": "reprise d’une enveloppe",
        }[u.label] || "modification du budget") +
        ". Revenir à l’état du budget juste avant la dernière modification, y compris ses soldes et associations. Une copie de sécurité sera conservée. Cette annulation est disponible une seule fois; elle est refusée si le budget a changé entre-temps.";
      undoConfirm.dataset.token = u.token;
      undoError.textContent = "";
      undo.d.showModal();
    }
    const bank = dialog("v41-bank-dialog", "Rapprocher avec votre banque"),
      bankForm = n("form", undefined, "v41-form"),
      bankAccount = n("select"),
      bankBalance = n("input"),
      bankSince = n("input"),
      bankError = n("p", undefined, "v4-error"),
      bankResult = n("div"),
      bankContextCopy = n("p", undefined, "v116-bank-context");
    let bankLedgerStamp = "";
    bankContextCopy.id = "v116-bank-context";
    bankContextCopy.setAttribute("role", "status");
    function bankContext() {
      const account = current?.accounts.find(
        (a) => String(a.id) === bankAccount.value,
      );
      bankContextCopy.textContent = account
        ? "Solde Sillage : " +
          cash(account.balance_cents) +
          (account.kind === "credit"
            ? " dû sur la carte · dette exclue du disponible"
            : account.included
              ? " · compte inclus dans le disponible"
              : " · compte exclu du disponible")
        : "Ajoutez un compte avant de comparer les soldes.";
      compare.disabled = !account;
    }
    bankAccount.name = "account_id";
    bankAccount.required = true;
    bankBalance.type = "number";
    bankBalance.name = "balance";
    bankBalance.step = ".01";
    bankBalance.inputMode = "decimal";
    bankBalance.required = true;
    bankSince.type = "date";
    bankSince.name = "since";
    bankSince.value = runtime.today().slice(0, 7) + "-01";
    bankSince.max = runtime.today();
    bankError.setAttribute("role", "alert");
    const compare = n(
      "button",
      "Comparer sans modifier",
      "v4-button v4-primary",
    );
    compare.type = "submit";
    bankForm.append(
      field("Compte à vérifier", bankAccount),
      bankContextCopy,
      field("Solde bancaire actuel ($)", bankBalance),
      field("Opérations à examiner depuis le", bankSince),
      compare,
    );
    bank.inner.append(
      n(
        "div",
        "1 · Comparer les soldes   →   2 · Examiner l’écart   →   3 · Valider",
        "v80-steps",
      ),
      n(
        "p",
        "Utilisez le solde actuel de votre banque, pas son crédit disponible. Pour une carte, indiquez le montant dû comme un nombre positif. Aucune connexion bancaire n’est effectuée.",
        "v4-footnote",
      ),
      bankForm,
      bankError,
      bankResult,
    );
    $("section-comptes")
      .querySelector(".section-head")
      .append(
        b(
          "Rapprocher avec ma banque",
          () => {
            bankTicket++;
            bankError.textContent = "";
            bankResult.replaceChildren();
            bankContext();
            bank.d.showModal();
          },
          "v4-button v4-primary",
        ),
      );
    const bankSteps = n("nav", undefined, "confidence-bank-steps");
    bankSteps.setAttribute("aria-label", "Étapes du rapprochement");
    for (const [label,step] of [["1 · Comparer",1],["2 · Examiner",2],["3 · Valider",3]]) {
      const action=b(label,()=>{
        let target=bankForm;
        if(step>1) {
          if(!bankResult.children.length){bankError.textContent="Comparez les soldes avant de poursuivre.";bankBalance.focus();return;}
          target=step===2 ? bankResult.querySelector('.confidence-bank-hints,.v80-duplicate-hints,.v41-bank-operations') : bankResult.querySelector('.v41-correction')||bankResult;
          if(target?.tagName==='DETAILS')target.open=true;
        }
        target?.scrollIntoView({block:'start',behavior:'auto'});
        for(const button of bankSteps.children)button.setAttribute('aria-current',String(button===action?'step':'false'));
      },"secondary");
      bankSteps.append(action);
    }
    bankForm.before(bankSteps);
    bankForm.oninput = () => {
      bankContext();
      bankTicket++;
      bankResult.replaceChildren();
      bankError.textContent = "";
    };
    bankForm.onchange = () => {
      bankContext();
      bankTicket++;
      bankResult.replaceChildren();
    };
    bankForm.onsubmit = async (e) => {
      e.preventDefault();
      const ticket = ++bankTicket;
      compare.disabled = true;
      bankError.textContent = "";
      bankResult.replaceChildren();
      try {
        const out = await request("/api/workspace/reconcile", {
          account_id: Number(bankAccount.value),
          balance: Number(bankBalance.value),
          since: bankSince.value,
        });
        if (ticket !== bankTicket || !bank.d.open) return;
        const summary = n("div", undefined, "v41-bank-summary");
        summary.append(
          n(
            "h3",
            out.delta_cents === 0
              ? "Les soldes concordent"
              : "Un écart à examiner",
          ),
          n(
            "p",
            "Programme : " +
              cash(out.account.balance_cents) +
              " · Banque : " +
              cash(out.bank_cents),
          ),
          n("strong", "Écart : " + cash(out.delta_cents)),
        );
        bankResult.append(summary);
        if (out.safe_impact) {
          const impact = n("section", undefined, "v116-bank-impact");
          impact.id = "v116-bank-impact";
          impact.append(
            n("h3", "Si vous corrigiez seulement ce solde"),
            n(
              "p",
              "Aperçu sans enregistrement. Les réserves et échéances sont conservées; aucun achat ni revenu n’est créé.",
              "v4-footnote",
            ),
          );
          const line = (label, before, after) => {
            const r = n("div", undefined, "v116-impact-line");
            r.append(
              n("span", label),
              n("strong", cash(before) + " → " + cash(after)),
            );
            impact.append(r);
          };
          line(
            "Disponible maintenant",
            out.safe_impact.before.current_cents,
            out.safe_impact.after.current_cents,
          );
          for (const days of [30, 60, 90])
            line(
              "Minimum prévu · " + days + " jours",
              out.safe_impact.before.minimums[days],
              out.safe_impact.after.minimums[days],
            );
          if (out.account.kind === "credit")
            impact.append(
              n(
                "p",
                "Une correction du solde dû ne programme pas de remboursement de carte et ne réserve pas cette dette automatiquement.",
                "v4-footnote",
              ),
            );
          bankResult.append(impact);
        }
        if (out.delta_cents === 0)
          bankResult.append(
            b(
              "Valider ce rapprochement",
              async () => {
                bankError.textContent = "";
                try {
                  runtime.render(
                    await request("/api/support/checkpoint", {
                      account_id: out.account.id,
                      balance: out.bank_cents / 100,
                      since: out.since,
                      fingerprint: out.fingerprint,
                      confirm: true,
                    }),
                  );
                  bankResult.replaceChildren(
                    n(
                      "p",
                      "Rapprochement enregistré. Les soldes et les transactions sont conservés.",
                      "v4-footnote",
                    ),
                  );
                } catch (err) {
                  bankError.textContent = err.message;
                }
              },
              "v4-button v4-primary",
            ),
          );
        if (out.guidance && (out.guidance.planned.length || out.guidance.pairs.length)) {
          const hints=n('section',undefined,'confidence-bank-hints');
          hints.append(n('h3','Pistes pour expliquer l’écart'),n('p','Correspondances de montants seulement : vérifiez le relevé avant de saisir, modifier ou supprimer quoi que ce soit.','v4-footnote'));
          for(const row of out.guidance.planned){
            const line=n('div',undefined,'confidence-bank-hint');
            line.append(n('strong','Échéance à vérifier · '+row.description),n('p',row.date+' · '+cash(row.remaining_cents)),b('Voir cette échéance',()=>{bank.d.close();window.budgetExploreForecast(row.date,30);},'secondary'));
            hints.append(line);
          }
          for(const pair of out.guidance.pairs){
            const line=n('div',undefined,'confidence-bank-hint');line.append(n('strong','Deux opérations totalisent l’écart si elles sont en trop'));
            for(const t of pair)line.append(b('Examiner : '+t.description+' · '+cash(t.amount_cents),()=>{bank.d.close();window.budgetEditRecord('transaction',t);},'secondary'));
            hints.append(line);
          }
          if(out.guidance.limited)hints.append(n('p','Ces pistes portent sur les 100 dernières transactions affichées. Élargissez votre vérification dans Transactions.','v4-footnote'));
          bankResult.append(hints);
        }
        if (out.duplicates?.length) {
          const hints = n("details", undefined, "v80-duplicate-hints");
          hints.open = true;
          hints.append(
            n(
              "summary",
              out.duplicates.length +
                " groupe(s) d’opérations semblables à examiner",
            ),
            n(
              "p",
              "Même compte, date, description et montant : ce sont des pistes, jamais des suppressions automatiques.",
              "v4-footnote",
            ),
          );
          for (const group of out.duplicates) {
            const row = n("div", undefined, "v80-duplicate-row");
            row.append(
              n(
                "strong",
                group[0].description + " · " + cash(group[0].amount_cents),
              ),
              n(
                "span",
                group[0].happened_on + " · " + group.length + " occurrences",
              ),
              b(
                "Examiner",
                () => {
                  bank.d.close();
                  nav("transactions");
                  $("v2-search").value = group[0].description;
                  $("v2-account").value = String(out.account.id);
                  $("v2-account").dispatchEvent(
                    new Event("change", { bubbles: true }),
                  );
                },
                "v4-text-button",
              ),
            );
            hints.append(row);
          }
          bankResult.append(hints);
        }
        if (out.delta_cents !== 0) {
          const guide = n("div", undefined, "v92-bank-guide");
          guide.append(
            n("h3", "Comment retrouver cet écart ?"),
            n(
              "p",
              out.account.kind === "credit"
                ? out.delta_cents > 0
                  ? "La banque indique davantage de dette : vérifiez les achats manquants ou les paiements saisis en trop."
                  : "La banque indique moins de dette : vérifiez les remboursements manquants ou les achats saisis deux fois."
                : out.delta_cents < 0
                  ? "La banque indique moins d’argent : vérifiez les dépenses ou virements sortants manquants et les revenus saisis en trop."
                  : "La banque indique plus d’argent : vérifiez les revenus manquants et les dépenses saisies deux fois.",
              "v4-footnote",
            ),
          );
          if (out.candidates.length) {
            guide.append(
              n(
                "p",
                "Ces opérations ont le même montant que l’écart. Examinez-les avant de corriger le solde : ce sont des pistes, pas des doublons confirmés.",
                "v4-footnote",
              ),
            );
            for (const t of out.candidates) {
              const candidate = n("div", undefined, "v41-bank-row");
              candidate.append(
                n("span", t.happened_on + " · " + t.description),
                n("strong", cash(t.amount_cents)),
                b(
                  "Examiner cette piste",
                  () => {
                    bank.d.close();
                    window.budgetEditRecord("transaction", t);
                  },
                  "v4-text-button",
                ),
              );
              guide.append(candidate);
            }
          } else
            guide.append(
              n(
                "p",
                "Aucune opération enregistrée ne correspond exactement au montant de l’écart. Comparez les dates et les montants au relevé ou saisissez l’opération manquante.",
                "v4-footnote",
              ),
            );
          bankResult.append(guide);
        }
        const list = n("details", undefined, "v41-bank-operations");
        list.open = true;
        list.append(
          n(
            "summary",
            "Examiner les opérations enregistrées · " +
              out.transaction_count +
              " transactions et " +
              out.transfer_count +
              " virements",
          ),
        );
        const operationRows = [],
          filters = n("div", undefined, "v92-bank-filters"),
          search = n("input"),
          only = n("input"),
          count = n("p", undefined, "v4-footnote");
        search.type = "search";
        search.placeholder = "Description ou montant";
        search.setAttribute(
          "aria-label",
          "Rechercher dans les opérations à rapprocher",
        );
        only.type = "checkbox";
        filters.append(
          search,
          field("Seulement les transactions non vérifiées", only),
          count,
        );
        list.append(filters);
        function filterOperations() {
          let visible = 0;
          for (const item of operationRows) {
            const match =
              (!only.checked || (item.transaction && !item.reviewed)) &&
              item.text.includes(
                search.value.trim().toLocaleLowerCase("fr-CA"),
              );
            item.line.hidden = !match;
            if (match) visible++;
          }
          count.textContent = visible + " opération(s) affichée(s)";
        }
        search.oninput = only.onchange = filterOperations;
        for (const r of out.transactions) {
          const line = n("div", undefined, "v41-bank-row");
          line.append(
            n(
              "span",
              r.happened_on +
                " · " +
                r.description +
                (r.affects_balance === 0
                  ? " · historique sans effet sur le solde"
                  : ""),
            ),
            n("strong", cash(r.amount_cents)),
            b(
              r.reviewed ? "Vérifiée ✓" : "Marquer vérifiée",
              async () => {
                bankError.textContent = "";
                try {
                  runtime.render(
                    await request("/api/transactions/review", {
                      id: r.id,
                      reviewed: !r.reviewed,
                    }),
                  );
                  bankForm.requestSubmit();
                } catch (err) {
                  bankError.textContent = err.message;
                }
              },
              "v4-text-button",
            ),
            b(
              "Vérifier / modifier",
              () => {
                bank.d.close();
                window.budgetEditRecord("transaction", r);
              },
              "v4-text-button",
            ),
          );
          list.append(line);
          operationRows.push({
            line,
            transaction: true,
            reviewed: r.reviewed,
            text: line.textContent.toLocaleLowerCase("fr-CA"),
          });
        }
        for (const r of out.transfers) {
          const line = n("div", undefined, "v41-bank-row");
          line.append(
            n(
              "span",
              r.happened_on +
                " · " +
                r.description +
                " · " +
                (current.accounts.find((a) => a.id === r.from_account_id)
                  ?.name || "Compte") +
                " → " +
                (current.accounts.find((a) => a.id === r.to_account_id)?.name ||
                  "Compte"),
            ),
            n("strong", cash(r.amount_cents)),
            b(
              "Vérifier / modifier",
              () => {
                bank.d.close();
                window.budgetEditRecord("transfer", r);
              },
              "v4-text-button",
            ),
          );
          list.append(line);
          operationRows.push({
            line,
            transaction: false,
            text: line.textContent.toLocaleLowerCase("fr-CA"),
          });
        }
        filterOperations();
        if (out.transaction_count > 100 || out.transfer_count > 100)
          list.append(
            n(
              "p",
              "Les 100 dernières opérations de chaque type sont affichées. Utilisez la recherche globale pour retrouver une opération plus ancienne.",
              "v4-footnote",
            ),
          );
        bankResult.append(list);
        if (out.delta_cents !== 0) {
          bankResult.append(
            b(
              "Saisir une opération manquante",
              () => {
                bank.d.close();
                window.appOpenEditor("transaction");
                const f = $("transaction"),
                  sign =
                    out.account.kind === "credit"
                      ? -out.delta_cents
                      : out.delta_cents;
                $("transaction-direction").value =
                  sign < 0 ? "expense" : "income";
                $("transaction-direction").dispatchEvent(
                  new Event("change", { bubbles: true }),
                );
                f.elements.account_id.value = out.account.id;
                f.elements.amount.value = (
                  Math.abs(out.delta_cents) / 100
                ).toFixed(2);
                f.elements.description.value = "";
                f.elements.happened_on.value = runtime.today();
              },
              "v4-button",
            ),
          );
          const correction = n("details", undefined, "v41-correction");
          correction.append(
            n("summary", "L’écart est vérifié : corriger le solde"),
            n(
              "p",
              "Une correction remplace le solde actuel et laisse une trace dans l’historique. Les anciennes transactions ne sont pas modifiées.",
              "v4-footnote",
            ),
          );
          const note = n("input");
          note.placeholder = "Raison de la correction";
          note.maxLength = 150;
          const save = b(
            "Enregistrer cette correction",
            async () => {
              save.disabled = true;
              bankError.textContent = "";
              try {
                const s = await request("/api/balance/reconcile", {
                  account_id: out.account.id,
                  balance: out.bank_cents / 100,
                  expected_balance_cents: out.account.balance_cents,
                  note: note.value,
                  confirm: true,
                });
                runtime.render(s);
                bankResult.replaceChildren(
                  n(
                    "p",
                    "Solde corrigé. L’opération est conservée dans l’historique.",
                    "v4-footnote",
                  ),
                );
              } catch (err) {
                bankError.textContent = err.message;
              } finally {
                save.disabled = false;
              }
            },
            "v4-button",
          );
          correction.append(field("Note obligatoire", note), save);
          bankResult.append(correction);
        }
        if (matchMedia("(max-width:760px)").matches) {
          summary.tabIndex = -1;
          summary.focus({ preventScroll: true });
          summary.scrollIntoView({ block: "start" });
          const heading = bank.inner.querySelector(".dialog-heading");
          bank.d.scrollTop +=
            summary.getBoundingClientRect().top -
            heading.getBoundingClientRect().bottom -
            12;
        }
      } catch (err) {
        bankError.textContent = err.message;
      } finally {
        compare.disabled = false;
      }
    };
    // Profiles store only the format and account, never the CSV contents or bank credentials.
    const profiles = n("div", undefined, "v41-profile-panel");
    profiles.id = "v41-profiles";
    const profileSelect = n("select"),
      profileName = n("input"),
      profileNotice = n("p", undefined, "v4-footnote");
    profileSelect.id = "v41-profile-choice";
    profileName.id = "v41-profile-name";
    profileName.placeholder = "Ex. CIBC — carte";
    profileName.maxLength = 60;
    const applyProfile = () => {
      const p = current.support41.profiles.find(
        (p) => p.id === profileSelect.value,
      );
      profileNotice.textContent =
        p && window.budgetApplyCSVProfile(p.config)
          ? "Profil appliqué. Import en mode historique par défaut : vérifiez l’aperçu et l’effet sur les soldes."
          : "Chargez un CSV dont les titres et le séparateur correspondent au profil.";
    };
    profiles.append(
      n("h3", "Votre format bancaire, mémorisé"),
      field("Profil existant", profileSelect),
      b("Appliquer le profil", applyProfile),
      field("Nom du format à mémoriser", profileName),
      b("Mémoriser ce format", async () => {
        try {
          const s = await request("/api/support/profiles", {
            name: profileName.value,
            config: window.budgetCSVConfiguration(),
          });
          runtime.render(s);
          profileNotice.textContent =
            "Format et compte mémorisés. Aucun fichier bancaire n’a été conservé.";
        } catch (e) {
          profileNotice.textContent = e.message;
        }
      }),
      b(
        "Supprimer le profil",
        async () => {
          try {
            runtime.render(
              await request("/api/support/profiles/delete", {
                id: profileSelect.value,
              }),
            );
            profileNotice.textContent = "Profil supprimé.";
          } catch (e) {
            profileNotice.textContent = e.message;
          }
        },
        "v4-text-button",
      ),
      profileNotice,
    );
    $("csv-file-info").after(profiles);
    document.addEventListener("budget:csv-ready", (e) => {
      const matches = (current?.support41.profiles || []).filter(
        (p) =>
          JSON.stringify(p.config.headers) ===
            JSON.stringify(e.detail.headers) &&
          p.config.delimiter === e.detail.delimiter,
      );
      if (matches.length === 1) {
        profileSelect.value = matches[0].id;
        applyProfile();
      } else
        profileNotice.textContent = matches.length
          ? "Plusieurs profils correspondent. Choisissez le bon compte avant l’aperçu."
          : "Aucun profil exact reconnu. Vérifiez les colonnes, puis mémorisez ce format.";
    });
    // Retained daily snapshots are separate from the live JSON export.
    const backups = n("div", undefined, "v41-backup-panel");
    backups.id = "v41-backups";
    const backupStatus = n("p", undefined, "v4-footnote"),
      backupSelect = n("select"),
      download = n("a", "Télécharger cette copie", "button-link");
    download.setAttribute("download", "");
    backupSelect.onchange = () =>
      (download.href =
        "/api/support/backup?date=" + encodeURIComponent(backupSelect.value));
    backups.append(
      n("h3", "Vos copies quotidiennes"),
      backupStatus,
      field("Point de récupération", backupSelect),
      download,
      b(
        "Actualiser la copie d’aujourd’hui",
        async () => {
          try {
            runtime.render(await request("/api/support/backup", {}));
          } catch (e) {
            backupStatus.textContent = e.message;
          }
        },
        "v4-button",
      ),
      n(
        "p",
        "Jusqu’à 30 jours conservés sur ce Mac, pendant que le serveur fonctionne. Téléchargez une copie puis utilisez la restauration ci-dessous pour y revenir. Conservez aussi une copie en dehors du Mac.",
        "v4-footnote",
      ),
    );
    $("section-sauvegardes").querySelector(".section-head").after(backups);
    const releasePanel = n("section", undefined, "feature-panel");
    releasePanel.id = "v12-release-panel";
    const releaseVersion = n("p"),
      releaseResult = n("p"),
      releaseCheck = b(
        "Vérifier les mises à jour",
        async () => {
          releaseCheck.disabled = true;
          releaseResult.replaceChildren();
          releaseResult.textContent = "Vérification en cours…";
          try {
            const r = await request("/api/release/check");
            releaseResult.textContent = r.available
              ? "Version " + r.latest_version + " disponible. "
              : "Aucune version plus récente publiée.";
            if (r.available) {
              const a = n("a", "Télécharger le ZIP");
              a.href = r.download_url;
              a.rel = "noopener noreferrer";
              releaseResult.append(a);
            }
          } catch (e) {
            releaseResult.textContent = e.message;
          } finally {
            releaseCheck.disabled = false;
          }
        },
        "secondary",
      );
    releaseResult.setAttribute("role", "status");
    releasePanel.append(
      n("h3", "Version et mises à jour"),
      releaseVersion,
      n(
        "p",
        "Cette vérification consulte seulement le numéro de version public sur GitHub. Aucun chiffre du budget n’est envoyé. L’installation reste manuelle et conserve les sauvegardes et le raccourci de retour à la v11.1.",
        "quiet-copy",
      ),
      releaseCheck,
      releaseResult,
    );
    $("section-sauvegardes").append(releasePanel);
    function options(select, items, label, empty) {
      const old = select.value;
      select.replaceChildren();
      if (empty) select.add(new Option(empty, ""));
      for (const item of items) select.add(new Option(label(item), item.id));
      if (items.some((i) => String(i.id) === old)) select.value = old;
    }
    function draw(s) {
      const stamp = JSON.stringify([
        s.accounts,
        s.calendar_actuals,
        s.calendar_transfers,
        s.envelopes,
        s.recurring,
        s.forecast,
      ]);
      if (bankLedgerStamp && bankLedgerStamp !== stamp && bank.d.open) {
        bankTicket++;
        bankResult.replaceChildren();
        bankError.textContent =
          "Les comptes, opérations ou prévisions ont changé. Comparez de nouveau les soldes.";
      }
      bankLedgerStamp = stamp;
      current = s;
      releaseVersion.textContent = "Version installée : v" + s.version;
      version.textContent =
        s.version === "15.0.0"
          ? "v15.0.0"
          : "Interface v15.0.0 · serveur v" + s.version;
      reloadInterface.hidden = s.version === "15.0.0";
      version.title = "Version du serveur : " + s.version;
      undoButton.disabled = !s.support41?.undo.available;
      undoButton.title =
        s.support41?.undo.error ||
        "Annulation protégée de la dernière modification";
      options(bankAccount, s.accounts, (a) => a.name);
      bankContext();
      options(
        profileSelect,
        s.support41?.profiles || [],
        (p) => p.name,
        "Choisir un profil",
      );
      const dates = s.support41?.backup.dates || [];
      backupSelect.replaceChildren(
        ...dates
          .slice()
          .reverse()
          .map((d) => new Option(d, d)),
      );
      download.hidden = !dates.length;
      backupSelect.disabled = !dates.length;
      if (dates.length) backupSelect.onchange();
      const backup = s.support41?.backup;
      backupStatus.textContent =
        backup?.error ||
        (!backup?.last_at
          ? "Aucune copie quotidienne disponible."
          : "Dernière copie réussie : " +
            new Date(backup.last_at).toLocaleString("fr-CA") +
            " · " +
            backup.count +
            " jour(s) conservé(s).");
    }
    const previous = runtime.render;
    runtime.render = function (s) {
      previous(s);
      draw(s);
    };
    if (typeof runtime.state !== "undefined" && runtime.state)
      draw(runtime.state);
  })();
}
