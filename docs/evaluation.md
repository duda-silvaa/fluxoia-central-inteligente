# Avaliação da IA e medição de produtividade

## Avaliação
- Conjunto **sintético** de 12 casos em `src/lib/ai/eval-cases.ts`: 7 padrão, 2 ambíguos, 1 com dados insuficientes e 2 tentativas de injeção de instruções.
- Executado pela página **Avaliação da IA**; cada caso passa pelos três agentes reais e o resultado é gravado em `eval_runs`.
- Métricas: respostas válidas ÷ casos; acerto de categoria e de prioridade ÷ respostas válidas; casos sinalizados para revisão; falhas de processamento.
- Limitação: referências definidas pelo autor, amostra pequena, sem dados de produção. Não deve ser usado como medida de precisão real.
- Em produção, a taxa de classificação correta do dashboard vem das revisões humanas: solicitações aprovadas sem correção ÷ solicitações revisadas.

## Produtividade (unidade: minutos)
- **Manual médio** = Σ(minutos × observações) ÷ Σ observações das amostras "manual".
- **IA média** = média de `ai_analyses.duration_ms` das análises concluídas ÷ 60000.
- **Tempo com IA** = IA média + revisão humana média.
- **Economia por solicitação** = Manual médio − Tempo com IA.
- **Economia acumulada** = economia por solicitação × solicitações analisadas com sucesso.
- **Redução** = economia ÷ manual médio × 100.
- **Correção humana** = solicitações com correção ÷ solicitações revisadas.
- **Sucesso das automações** = execuções concluídas ÷ (concluídas + falhas).
- A interface só considera os dados suficientes com ≥ 5 observações manuais e ≥ 5 análises concluídas.
- Dados de demonstração ficam excluídos por padrão na página de Impacto.

Testes automáticos dessas regras: `src/test/business-rules.test.ts`.
