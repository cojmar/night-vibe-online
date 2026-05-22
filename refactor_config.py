import re

with open('app/config.js', 'r') as f:
    content = f.read()

# 1. Remove MOVE_SPEED from FALLBACK_DEFAULTS
content = re.sub(r'\s*// 1\. Player Movement \(Simple\)\s*MOVE_SPEED:\s*2\.5,', '', content)
content = re.sub(r'MOVE_SPEED: 2\.5,', '', content)

# 2. Add BOSS_LASER_DPS to FALLBACK_DEFAULTS
content = content.replace(
    'BOSS_LASER_DAMAGE_INTERVAL: 300,',
    'BOSS_LASER_DAMAGE_INTERVAL: 300,\n  BOSS_LASER_DPS: 40,'
)

# 3. Move CLASS_DATA, ENEMY_TYPES, SKILL_DESC into FALLBACK_DEFAULTS
# First, extract them
class_data_match = re.search(r'export const CLASS_DATA = ({.*?});\s*', content, re.DOTALL)
enemy_types_match = re.search(r'export const ENEMY_TYPES = (\[.*?\]);\s*', content, re.DOTALL)
skill_desc_match = re.search(r'export const SKILL_DESC = ({.*?});\s*', content, re.DOTALL)

if class_data_match and enemy_types_match and skill_desc_match:
    class_data_str = class_data_match.group(1)
    enemy_types_str = enemy_types_match.group(1)
    skill_desc_str = skill_desc_match.group(1)
    
    # Remove old const declarations
    content = content.replace(class_data_match.group(0), '')
    content = content.replace(enemy_types_match.group(0), '')
    content = content.replace(skill_desc_match.group(0), '')
    
    # Append to FALLBACK_DEFAULTS
    # Find the end of FALLBACK_DEFAULTS
    fallback_end = content.find('};', content.find('const FALLBACK_DEFAULTS'))
    
    inject_str = f",\n\n  // 13. Game Data Entities\n  CLASS_DATA: {class_data_str},\n  ENEMY_TYPES: {enemy_types_str},\n  SKILL_DESC: {skill_desc_str}\n"
    content = content[:fallback_end] + inject_str + content[fallback_end:]

# 4. Remove MOVE_SPEED from CONFIG_METADATA
content = re.sub(r'\s*// 1\. Player Movement \(Simple\)\s*MOVE_SPEED:\s*{[^}]+},', '', content)

# 5. Add BOSS_LASER_DPS to CONFIG_METADATA
content = content.replace(
    'BOSS_LASER_DAMAGE_INTERVAL: { label: "Boss Laser Damage Interval (ms)", type: "number", min: 50, max: 2000, step: 50, category: "Boss Battles" },',
    'BOSS_LASER_DAMAGE_INTERVAL: { label: "Boss Laser Damage Interval (ms)", type: "number", min: 50, max: 2000, step: 50, category: "Boss Battles" },\n  BOSS_LASER_DPS: { label: "Boss Laser Damage Per Second", type: "number", min: 5, max: 200, step: 5, category: "Boss Battles" },'
)

# 6. Add Entities to CONFIG_METADATA
metadata_end = content.find('};', content.find('export const CONFIG_METADATA'))
inject_meta = ",\n  // 12. Game Data Entities (JSON)\n  CLASS_DATA: { label: \"Classes & Characters\", type: \"json\", category: \"Game Data Entities\" },\n  ENEMY_TYPES: { label: \"Enemy Types & Stats\", type: \"json\", category: \"Game Data Entities\" },\n  SKILL_DESC: { label: \"Skills Descriptions & Names\", type: \"json\", category: \"Game Data Entities\" }\n"
content = content[:metadata_end] + inject_meta + content[metadata_end:]

# 7. Update let exports
content = re.sub(r'export let MOVE_SPEED = activeConfig\.MOVE_SPEED;\s*', '', content)
# Add exports for new vars
content = content.replace(
    'export let BOSS_LASER_DAMAGE_INTERVAL = activeConfig.BOSS_LASER_DAMAGE_INTERVAL;',
    'export let BOSS_LASER_DAMAGE_INTERVAL = activeConfig.BOSS_LASER_DAMAGE_INTERVAL;\nexport let BOSS_LASER_DPS = activeConfig.BOSS_LASER_DPS;'
)
# Add exports for entities right before static consts
content = content.replace(
    '// Static-structure configurations',
    'export let CLASS_DATA = activeConfig.CLASS_DATA;\nexport let ENEMY_TYPES = activeConfig.ENEMY_TYPES;\nexport let SKILL_DESC = activeConfig.SKILL_DESC;\n\n// Static-structure configurations'
)

# 8. Update updateConfig function
content = re.sub(r'\s*MOVE_SPEED = activeConfig\.MOVE_SPEED;', '', content)

content = content.replace(
    'BOSS_LASER_DAMAGE_INTERVAL = activeConfig.BOSS_LASER_DAMAGE_INTERVAL;',
    'BOSS_LASER_DAMAGE_INTERVAL = activeConfig.BOSS_LASER_DAMAGE_INTERVAL;\n  BOSS_LASER_DPS = activeConfig.BOSS_LASER_DPS;'
)

update_cfg_end = content.find(' }', content.find('export function updateConfig'))
inject_update = "\n  CLASS_DATA = activeConfig.CLASS_DATA;\n  ENEMY_TYPES = activeConfig.ENEMY_TYPES;\n  SKILL_DESC = activeConfig.SKILL_DESC;\n"
content = content[:update_cfg_end] + inject_update + content[update_cfg_end:]

with open('app/config.js', 'w') as f:
    f.write(content)

