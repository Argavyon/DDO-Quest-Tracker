const core = require('@actions/core');
const fs = require('fs');
const fetch = (...args) => import('node-fetch')
.then(
    ({default: fetch}) => fetch(...args)
);
const jsdom = require("jsdom");
function parseCommaInt(str) { return parseInt((str ?? '').replace(/,/g, '')); }

fetch(`${core.getInput('proxy')}https://ddowiki.com/page/Quests_by_level_and_XP`, { cache: 'default', })
.then(resp => resp.text())
.then(html => {
    const wikiPage = (new jsdom.JSDOM(html, 'text/html'));
    const difficulties = { 0: 'Heroic', 1: 'Epic', 2: 'Legendary' };
    const questData = Array.from(wikiPage.window.document.querySelectorAll('table'))
    .filter(table => !table.querySelector('#toc'))
    .map((table, tableIndex) =>
        Array.from(table.querySelectorAll('tr'))
        .filter(tr => !tr.querySelector('th'))
        .map(tr => ({
                name:
                    tr.children[0].textContent.trim(),
                difficulty:
                    difficulties[tableIndex],
                level:
                    tableIndex == 1
                    ? parseInt(tr.children[1].textContent.slice(tr.children[1].textContent.indexOf('/')+1))
                    : parseInt(tr.children[1].textContent),
                soloXP:
                    parseCommaInt(tr.children[2].innerHTML),
                normalXP:
                    parseCommaInt(tr.children[3].innerHTML),
                hardXP:
                    parseCommaInt(tr.children[4].innerHTML),
                eliteXP:
                    parseCommaInt(tr.children[5].innerHTML),
                duration:
                    tr.children[6].textContent.trim(),
                pack:
                    tr.children[7].textContent.trim(),
                patron:
                    tr.children[8].textContent.trim(),
                favor:
                    parseInt(tr.children[9].textContent)
            })
        )
    )
    .flat(1);
    fs.writeFile(
        'quests.json',
        JSON.stringify(questData),
        err => { if (err) { console.error(err); } }
    );
});
