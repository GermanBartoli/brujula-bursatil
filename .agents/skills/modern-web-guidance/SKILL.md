---
name: modern-web-guidance
description: Consultar Modern Web Guidance para cambios de HTML, CSS, accesibilidad y JavaScript del navegador en este proyecto.
---

# Modern Web Guidance

Antes de cambiar una interfaz, buscá la capacidad concreta con la [herramienta del equipo de Chrome](https://github.com/GoogleChrome/modern-web-guidance). Usá una consulta breve en inglés y recuperá la guía cuyo resumen coincida con el cambio.

```sh
npx -y modern-web-guidance@1.0.1 search "name modal dialog"
npx -y modern-web-guidance@1.0.1 retrieve dialog
```

Para una revisión general del proyecto, ejecutá `npx -y modern-web-guidance@1.0.1 legacy-scan . --json`. Contrastá las coincidencias con el código fuente y su compatibilidad antes de editar. Conservá las alternativas necesarias para los navegadores admitidos y verificá la interacción afectada en el navegador.
