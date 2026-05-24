import re

with open('app/ui.js', 'r') as f:
    content = f.read()

# Insert showDetails after getting p
p_logic = """            } catch (e) {
                p = { inventory: [], equipment: {} };
            }
        }
"""
show_details_logic = """
        const detailsPanel = document.getElementById('inventory-details-panel');
        if (detailsPanel) detailsPanel.style.display = 'none';
        
        const showDetails = (item, isEquipped, slotNameOrIndex) => {
            if (!detailsPanel) return;
            detailsPanel.style.display = 'flex';
            
            const dIcon = document.getElementById('inv-details-icon');
            const dName = document.getElementById('inv-details-name');
            const dType = document.getElementById('inv-details-type');
            const dStats = document.getElementById('inv-details-stats');
            const btnPrimary = document.getElementById('btn-inv-action-primary');
            const btnDrop = document.getElementById('btn-inv-action-drop');
            
            let resolvedIcon = item.icon || '💎';
            if (resolvedIcon === '📦') {
                const template = ConfigModule.ITEMS_DB.find(t => t.name === item.name);
                if (template && template.icon) resolvedIcon = template.icon;
            }
            if (resolvedIcon && typeof resolvedIcon === 'string' && (resolvedIcon.startsWith('data:image/') || resolvedIcon.startsWith('http'))) {
                dIcon.innerHTML = `<img src="${resolvedIcon}" style="width:100%; height:100%; object-fit:contain; border-radius:4px;" />`;
            } else {
                dIcon.innerText = resolvedIcon;
            }
            
            dName.textContent = item.name || 'Item';
            dName.style.color = item.color || '#fff';
            dType.textContent = item.gearType || item.type || 'Consumable';
            
            dStats.innerHTML = item.stats ? Object.entries(item.stats).map(([k, v]) => `<div><strong style="color:#fff;">${k.toUpperCase()}:</strong> +${v.toFixed(1)}</div>`).join('') : 'No stats';
            
            btnPrimary.textContent = isEquipped ? 'Unequip' : 'Equip';
            btnPrimary.onclick = () => {
                if (isEquipped) {
                    p.inventory.push(item);
                    delete p.equipment[slotNameOrIndex];
                } else {
                    const fallbackSlots = "Weapon,Armor,Ring 1,Ring 2,Amulet";
                    const rawSlots = ConfigModule.EQUIPMENT_SLOTS || fallbackSlots;
                    const slotNames = String(rawSlots).split(',').map(s => s.trim());
                    let targetSlot;
                    const itemType = (item.gearType || item.type || '').toLowerCase();
                    if (ConfigModule.ENFORCE_GEAR_SLOTS) {
                        targetSlot = slotNames.find(s => s.toLowerCase().includes(itemType) && !p.equipment[s]) || slotNames.find(s => s.toLowerCase().includes(itemType));
                    } else {
                        targetSlot = slotNames.find(s => s.toLowerCase().includes(itemType)) || slotNames.find(s => !p.equipment[s]) || slotNames[0];
                    }
                    if (targetSlot) {
                        if (p.equipment[targetSlot]) {
                            p.inventory.push(p.equipment[targetSlot]);
                        }
                        p.equipment[targetSlot] = item;
                        p.inventory.splice(slotNameOrIndex, 1);
                    }
                }
                
                if (this.game && this.game.player) {
                    this.game.saveLocalProgression();
                    this.game.broadcastState();
                    this.updateHUD(p);
                } else {
                    localStorage.setItem('nightvibe-inventory', JSON.stringify(p.inventory));
                    localStorage.setItem('nightvibe-equipment', JSON.stringify(p.equipment));
                }
                this.renderInventory();
            };
            
            btnDrop.onclick = async () => {
                if (await this.showConfirm("⚠️ Drop Item", `Drop ${item.name}?`)) {
                    if (isEquipped) {
                        delete p.equipment[slotNameOrIndex];
                    } else {
                        p.inventory.splice(slotNameOrIndex, 1);
                    }
                    item.x = (this.game && this.game.player) ? p.x + (Math.random() * 60 - 30) : ConfigModule.GAME_W / 2 + (Math.random() * 60 - 30);
                    item.y = (this.game && this.game.player) ? p.y + (Math.random() * 60 - 30) + 20 : ConfigModule.GAME_H / 2 + (Math.random() * 60 - 30) + 20;
                    item.life = 60000;
                    if (this.game && this.game.player) {
                        if (this.game.isHost) {
                            this.game.items.push(item);
                        } else {
                            const netItem = { ...item, icon: (item.icon && typeof item.icon === 'string' && item.icon.startsWith('data:image/')) ? '📦' : item.icon };
                            this.game.net.send_cmd('set_data', { spawnItem: netItem });
                        }
                        this.game.saveLocalProgression();
                        this.game.broadcastState();
                        this.updateHUD(p);
                    } else {
                        localStorage.setItem('nightvibe-inventory', JSON.stringify(p.inventory));
                        localStorage.setItem('nightvibe-equipment', JSON.stringify(p.equipment));
                    }
                    this.renderInventory();
                }
            };
        };
"""

content = content.replace(p_logic, p_logic + show_details_logic)

# Replace the equipped item render logic (from dropBtn creation to end of contextmenu)
eq_match = re.search(r"slotDiv\.style\.position = 'relative';\s*const dropBtn = document\.createElement\('div'\);.*?\}\);", content, re.DOTALL)
if eq_match:
    content = content.replace(eq_match.group(0), """slotDiv.addEventListener('click', () => {
                    if (itemData) showDetails(itemData, true, slotName);
                });""")

# Replace the backpack item render logic
inv_match = re.search(r"cell\.style\.position = 'relative';\s*const dropBtn = document\.createElement\('div'\);.*?\}\);", content, re.DOTALL)
if inv_match:
    content = content.replace(inv_match.group(0), """cell.addEventListener('click', () => {
                    showDetails(item, false, index);
                });""")

with open('app/ui.js', 'w') as f:
    f.write(content)
