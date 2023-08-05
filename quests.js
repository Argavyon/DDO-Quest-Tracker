'use strict';

Array.prototype.all = Array.prototype.every;
Array.prototype.any = Array.prototype.some;
Array.prototype.none = function (...args) { return !this.some(...args); };
function parseCommaInt(str) { return parseInt((str ?? '').replace(/,/g, '')); }
function createTypedElement(type, { classes = [], style = {}, ...properties }, children = []) {
    const element = document.createElement(type);
    
    if (classes) element.classList.add(...classes);
    Object.entries(style).forEach(([property, value]) => element.style[property] = value);
    Object.entries(properties).forEach(([key, value]) => element[key] = value);

    children.forEach(child => {
        element.appendChild(createTypedElement(...child))
    });

    return element;
}

const levelSelectorValue = document.querySelector('div#level-selector span');
const levelSelector = document.querySelector('div#level-selector input[type="range"]');
const packPicker = document.querySelector('div#pack-picker');
const questTableContainer = document.querySelector('div#quest-table');

async function main() {
    // Fetch data
    const questDataArray = await fetch(window.location.origin === 'file://' ? 'https://argavyon.github.io/DDO-Quest-Tracker/quests.json' : 'quests.json').then(resp => resp.json());
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
        tableHead.appendChild(createTypedElement('tr', {}, [
            ['td', { textContent: 'Quest Name', style: { width: '20%' } }],
            ['td', { textContent: 'Quest Level', style: { width: '5%' } }],
            ['td', { textContent: 'Base XP', style: { width: '5%' } }],
            ['td', { textContent: 'Duration', style: { width: '5%' } }],
            ['td', { textContent: 'Pack', style: { width: '20%' } }],
            ['td', { textContent: 'Patron', style: { width: '15%' } }],
            ['td', { textContent: 'Base Favor', style: { width: '5%' } }]
        ]));

        const tableBody = questTable.appendChild(document.createElement('tbody'));
        filteredQuests.forEach(quest => {
            const questType = (quest.soloXP == null && quest.normalXP != null && 'raid') || (quest.soloXP != null && quest.normalXP == null && 'solo');
            tableBody.appendChild(createTypedElement(
                'tr',
                { classes: questType ? [questType] : [], onclick: markQuest, value: quest.name, level: quest.level },
                [
                    ['td', { textContent: questType ? `${questType.toUpperCase()} - ${quest.name}` : quest.name }],
                    ['td', { textContent: quest.level }],
                    ['td', { textContent: quest.normalXP ?? quest.soloXP ?? '-' }],
                    ['td', { textContent: quest.duration }],
                    ['td', { textContent: quest.pack }],
                    ['td', { textContent: quest.patron ?? '-' }],
                    ['td', { textContent: quest.favor ?? '-' }]
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
        const pack = this.parentNode.value;
        const mainButton = this.parentNode.firstChild;

        if (event.shiftKey || this.classList.contains('prefer-heroic')) {
            questPackState[pack].heroicOnly ^= 1;
            mainButton.classList.toggle('pack-prefer-heroic', questPackState[pack].heroicOnly);
        }
        else if (event.ctrlKey || this.classList.contains('restore-quests')) {
            completedQuests = completedQuests.filter(quest => quests.Packs[quest] != pack);
            localStorage.setItem('##Completed Quests', JSON.stringify(completedQuests));
        }
        else if (event.altKey || this.classList.contains('require')) {
            questPackState[pack].excluded = 0;
            questPackState[pack].required ^= 1;
            mainButton.classList.toggle('pack-excluded', questPackState[pack].excluded);
            mainButton.classList.toggle('pack-required', questPackState[pack].required);
        }
        else {
            questPackState[pack].excluded ^= 1;
            questPackState[pack].required = 0;
            mainButton.classList.toggle('pack-excluded', questPackState[pack].excluded);
            mainButton.classList.toggle('pack-required', questPackState[pack].required);
        }
        localStorage.setItem(pack, JSON.stringify(questPackState[pack]));

        redrawQuestTable();
    }
    function markQuest() {
        completedQuests.push(this.value);
        localStorage.setItem('##Completed Quests', JSON.stringify(completedQuests));
        this.remove();
    }

    questPacks.forEach(pack => {
        packPicker.appendChild(createTypedElement('div', { value: pack, style: { textAlign: 'center' } }, [
            ['button', {
                textContent: pack,
                classes: [
                    ...(questPackState[pack].excluded ? ['pack-excluded'] : []),
                    ...(questPackState[pack].required ? ['pack-required'] : []),
                    ...(questPackState[pack].heroicOnly ? ['pack-prefer-heroic'] : []),
                ],
                onclick: packButtonClick
            }],
            ['button', {
                textContent: 'Req',
                classes: ['mobile', 'require'],
                onclick: packButtonClick
            }],
            ['button', {
                textContent: 'Hero',
                classes: ['mobile', 'prefer-heroic'],
                onclick: packButtonClick
            }],
            ['button', {
                textContent: 'Reset',
                classes: ['mobile', 'restore-quests'],
                onclick: packButtonClick
            }]
        ]));
    });

    questTableContainer.appendChild(createQuestTable());
}

main();
