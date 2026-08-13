# RC1 Static Validation

Generated: 2026-07-28T03:25:34.596Z

## Verdict: **RC1_BLOCKED**

| Metric | Value |
| --- | ---: |
| Total | 32 |
| Passed | 31 |
| Failed | 1 |
| Failed critical | 1 |

## Results

| Check | Status | ms | Critical |
| --- | --- | ---: | --- |
| `typecheck` | pass | 13263 | yes |
| `lint` | pass | 14467 | yes |
| `build` | fail | 113547 | yes |
| `verify:foundation` | pass | 1199 | yes |
| `verify:mobile` | pass | 928 | yes |
| `verify:infra` | pass | 1317 | yes |
| `verify:db:fresh` | pass | 19669 | yes |
| `verify:matching` | pass | 788 | no |
| `verify:offers` | pass | 881 | no |
| `verify:unlock` | pass | 1084 | no |
| `verify:payments` | pass | 906 | no |
| `verify:stripe` | pass | 800 | no |
| `verify:financial-documents` | pass | 748 | no |
| `verify:refunds` | pass | 902 | no |
| `verify:finance` | pass | 1221 | no |
| `verify:reviews` | pass | 1016 | no |
| `verify:reputation` | pass | 907 | no |
| `verify:quality` | pass | 814 | no |
| `verify:fraud` | pass | 800 | no |
| `verify:ai-ops` | pass | 770 | no |
| `verify:matching-engine` | pass | 698 | no |
| `verify:pricing` | pass | 769 | no |
| `verify:forecast` | pass | 740 | no |
| `verify:scheduling` | pass | 722 | no |
| `verify:business-assistant` | pass | 702 | no |
| `verify:marketplace-intelligence` | pass | 775 | no |
| `verify:chat` | pass | 793 | no |
| `verify:provider-dashboard` | pass | 731 | no |
| `verify:admin` | pass | 694 | no |
| `verify:mobile-production` | pass | 749 | no |
| `mobile:typecheck` | pass | 9536 | no |
| `validate:i18n` | pass | 1704 | yes |
