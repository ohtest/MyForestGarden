# Skills

每个 Skill 是一个 Markdown 文件，可随时增删。后端启动和每次对话前都会重新读取。

```md
---
id: my-skill
name: 技能名称
enabled: true
---

写给模型看的技能说明。
```

把 `enabled` 改成 `false` 即可停用，不必删除文件。
