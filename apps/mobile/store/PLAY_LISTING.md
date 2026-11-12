# Google Play listing — Secretlink

Package: `life.secretlink.app`  
Privacy: https://secretlink.life/privacy  
Terms: https://secretlink.life/terms  
Support: https://secretlink.life/contact  
Contact email: use the public support address you publish on the store listing

## Required store assets

| Asset | Path | Spec |
| --- | --- | --- |
| App icon | `store/icon-512.png` | 512×512 PNG |
| Feature graphic | `store/feature-graphic.png` | 1024×500 PNG |
| Phone screenshots | `store/screenshots/` | min 2, 16:9 or 9:16 |

Copy text from `store/en-US/`.

## Play Console checklist

1. Create app → app name **Secretlink**, default language English
2. App access / declarations (18+, user-generated content, location, camera)
3. Data safety form aligned with privacy policy
4. Content rating questionnaire
5. Target audience: 18+
6. Upload production AAB from EAS
7. Set store listing + graphics
8. Submit to production or closed testing first

## EAS submit

Place a Play Console service-account JSON at a local path (do not commit), then:

```bash
eas submit -p android --latest --profile production
```

Or configure `eas.json` → `submit.production.android.serviceAccountKeyPath`.
