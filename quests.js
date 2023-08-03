'use strict';

Array.prototype.all = Array.prototype.every;
Array.prototype.any = Array.prototype.some;
Array.prototype.none = function (...args) { return !this.some(...args); };
function parseCommaInt(str) { return parseInt((str ?? '').replace(/,/g, '')); }
function createCell({ classes = [], style = {}, ...attributes }) {
    const cell = document.createElement('td');

    if (classes) cell.classList.add(...classes);
    Object.entries(style).forEach(([property, value]) => cell.style[property] = value);
    Object.entries(attributes).forEach(([key, value]) => cell[key] = value);

    return cell;
}
function createRow({ text, classes = [], style = {}, ...attributes }, cells) {
    const row = document.createElement('tr');
    
    if (classes) row.classList.add(...classes);
    Object.entries(style).forEach(([property, value]) => row.style[property] = value);
    Object.entries(attributes).forEach(([key, value]) => row[key] = value);

    cells.forEach(cell => row.appendChild(createCell(cell)));

    return row;
}

const levelSelectorValue = document.querySelector('div#level-selector span');
const levelSelector = document.querySelector('div#level-selector input[type="range"]');
const packPicker = document.querySelector('div#pack-picker');
const questTableContainer = document.querySelector('div#quest-table');

async function main() {
    // Fetch data
    // const questDataArray = JSON.parse(document.getElementById('quest-data').innerHTML);
    const questDataArray = await fetch('quests.json').then(resp => resp.json());
    const questPacks = ['Free to Play'];
    const quests = { Heroic: {}, Epic: {}, Legendary: {}, Packs: {} };
    questDataArray.forEach(quest => {
        quests[quest.difficulty][quest.name] = quest;
        if(!(questPacks.includes(quest.pack))) questPacks.push(quest.pack);
        quests.Packs[quest.name] = quest.pack;
    });
    questPacks.sort((A,B) => (A === 'Free to Play' && -1) || A.localeCompare(B).quest );

    // Fetch state
    const questPackState = questPacks.reduce((accumulatorObj, questPack) => {
        accumulatorObj[questPack] = JSON.parse(localStorage.getItem(questPack)) ?? {
            excluded: 0,
            required: 0,
            heroicOnly: 0,
        };
        return accumulatorObj;
    }, {});
    let completedQuests = JSON.parse(localStorage.getItem('##Completed Quests')) ?? [];
    let minLevel = JSON.parse(localStorage.getItem('##Min Level')) ?? 1;

    levelSelectorValue.textContent = minLevel;
    levelSelector.value = minLevel;
    levelSelector.onclick = levelChange;

    function createQuestTable() {
        const requiredQuestPacks = Object.values(questPackState).any(pack => pack.required);
        const filteredQuests = Object.values(quests.Heroic).filter(quest =>
            (requiredQuestPacks ? questPackState[quest.pack].required : !questPackState[quest.pack].excluded)
            && (questPackState[quest.pack].heroicOnly || !(quest.name in quests.Epic || quest.name in quests.Legendary))
            && quest.level >= minLevel
            && completedQuests.none(completedQuest => quest.name.match(completedQuest))
            && quest.patron
        );
        filteredQuests.push(...[...Object.values(quests.Epic), ...Object.values(quests.Legendary)].filter(quest =>
            (requiredQuestPacks ? questPackState[quest.pack].required : !questPackState[quest.pack].excluded)
            && (!questPackState[quest.pack].heroicOnly || !(quest.name in quests.Heroic))
            && quest.level >= minLevel
            && completedQuests.none(completedQuest => quest.name.match(completedQuest))
            && quest.patron
        ));
        filteredQuests.sort((A,B) =>
            A.level - B.level
            || A.pack !== B.pack && ((A.pack === 'Free to Play' && -1) || (B.pack === 'Free to Play' && 1))
            || A.pack.localeCompare(B.pack)
            || A.patron.localeCompare(B.patron)
            || A.name.localeCompare(B.name)
        );

        const questTable = document.createElement('table');

        const tableHead = questTable.appendChild(document.createElement('thead'));
        tableHead.appendChild(createRow({}, [
            { textContent: 'Quest Name', style: { width: '20%' } },
            { textContent: 'Quest Level', style: { width: '5%' } },
            { textContent: 'Base XP', style: { width: '5%' } },
            { textContent: 'Duration', style: { width: '5%' } },
            { textContent: 'Pack', style: { width: '20%' } },
            { textContent: 'Patron', style: { width: '15%' } },
            { textContent: 'Base Favor', style: { width: '5%' } }
        ]));

        const tableBody = questTable.appendChild(document.createElement('tbody'));
        filteredQuests.forEach(quest => {
            const questType = (quest.soloXP == null && quest.normalXP != null && 'raid') || (quest.soloXP != null && quest.normalXP == null && 'solo');
            tableBody.appendChild(createRow(
                { classes: questType ? [questType] : [], onclick: markQuest, value: quest.name, level: quest.level },
                [
                    { textContent: questType ? `${questType.toUpperCase()} - ${quest.name}` : quest.name },
                    { textContent: quest.level },
                    { textContent: quest.normalXP ?? quest.soloXP ?? '-' },
                    { textContent: quest.duration },
                    { textContent: quest.pack },
                    { textContent: quest.patron ?? '-' },
                    { textContent: quest.favor ?? '-' }
                ]
            ));
        });
        
        return questTable;
    }
    function redrawQuestTable() {
        questTableContainer.replaceChild(createQuestTable(), questTableContainer.firstChild);
    }

    function levelChange() {
        minLevel = this.value;
        localStorage.setItem('##Min Level', JSON.stringify(minLevel));

        levelSelectorValue.textContent = minLevel;

        redrawQuestTable();
    }
    function packButtonClick(event) {
        if (event.shiftKey) {
            questPackState[this.value].heroicOnly ^= 1;
            this.classList.toggle('pack-heroicOnly', questPackState[this.value].heroicOnly);
        }
        else if (event.ctrlKey) {
            completedQuests = completedQuests.filter(quest => quests.Packs[quest] != this.value);
            localStorage.setItem('##Completed Quests', JSON.stringify(completedQuests));
        }
        else if (event.altKey) {
            questPackState[this.value].excluded = 0;
            questPackState[this.value].required ^= 1;
            this.classList.toggle('pack-excluded', questPackState[this.value].excluded);
            this.classList.toggle('pack-required', questPackState[this.value].required);
        }
        else {
            questPackState[this.value].excluded ^= 1;
            questPackState[this.value].required = 0;
            this.classList.toggle('pack-excluded', questPackState[this.value].excluded);
            this.classList.toggle('pack-required', questPackState[this.value].required);
        }
        localStorage.setItem(this.value, JSON.stringify(questPackState[this.value]));

        redrawQuestTable();
    }
    function markQuest() {
        completedQuests.push(this.value);
        localStorage.setItem('##Completed Quests', JSON.stringify(completedQuests));
        this.remove();
    }

    questPacks.forEach(pack => {
        const packButton = packPicker.appendChild(document.createElement('button'));
        packButton.textContent = pack;
        packButton.value = pack;
        packButton.onclick = packButtonClick;
        packButton.classList.toggle('pack-excluded', questPackState[pack].excluded);
        packButton.classList.toggle('pack-required', questPackState[pack].required);
        packButton.classList.toggle('pack-heroicOnly', questPackState[pack].heroicOnly);
    });

    questTableContainer.appendChild(createQuestTable(1));
}

main();
