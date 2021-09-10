// before it's news 
import fetch from 'node-fetch';
import puppeteer from "puppeteer";
import fs from "fs";
import csvWriter from "csv-write-stream";

// health news only! : 117 titles

let titles = [];
let dates = [];
let links = [];
let mnthMap = { '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
'07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'};

function formatDate(date) {
    let yr = date.split("-")[0];
    let mnth = mnthMap[date.split("-")[1]];
    let day = parseInt(date.split("-")[2]);

    return `${mnth} ${day}, ${yr}`;
}

function grabText() {
    let lst_ = [];
    document.querySelectorAll("article div#body p").forEach((el) => {
        text = el.innerText; 
        if (text.length != 0) { 
            lst_.push(text)
        }
    });
    return lst_.join(" ");
}

async function textExtract(URL) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    try {
        await page.goto(URL, {waitUntil: 'load', timeout: 2 * 60 * 1000});
        let text = await page.evaluate(grabText);
    
        await browser.close();
        return text;
    } catch(e) {
        return "";
    }
}

function addToCSV(titles, texts) {
    let filePath = "../fake/fake_beforeitsnews_content.csv";
    let log = csvWriter({sendHeaders: false});
    if (!fs.existsSync(filePath))
        log = csvWriter({ headers: ["Title", "Len", "Content"]});

    log.pipe(fs.createWriteStream(filePath, { flags: 'a' }));

    log.write({
        "Title": titles,
        "Len": texts.length,
        "Content": texts
    });

    log.end();
}

function addToCSVNoTexts(titles, dates, links) {
    let filePath = "../fake/fake_beforeitsnews_title.csv";
    let log = csvWriter({sendHeaders: false});
    if (!fs.existsSync(filePath))
        log = csvWriter({ headers: ["Title", "Publishing Date", "Source"]});

    log.pipe(fs.createWriteStream(filePath, { flags: 'a' }));

    let length = titles.length;

    for (let row = 0; row < length; ++row) {
        log.write({
            "Title": titles[row],
            "Publishing Date": dates[row],
            "Source": links[row]
        });
    }

    log.end();
}

function extractResults(results) {
    let titles = [];
    let links = [];
    let dates = [];

    for (let idx = 0; idx < results.length; ++idx) {
        let result = results[idx];
        if (result.richSnippet.metatags.twitterTitle !== undefined) {
            let title = result.richSnippet.metatags.twitterTitle.split('|')[0];
            if (!title.toLowerCase().includes('speech') &&  !title.toLowerCase().includes('conference')) {
                let link = result.url;
                let date = formatDate(result.richSnippet.metatags.date.split(" ")[0]);

                titles.push(title);
                links.push(link);
                dates.push(date);
            }
        }
    }

    addToCSVNoTexts(titles, dates, links);

    return { titles, links, dates };
}

async function fetchData() {
    let size = 10;
    for (let idx = 1; idx <= 10; ++idx) {
        console.log(`Extracting articles from page ${idx}`);
        let from_ = (idx-1) * size;
        
        let URL = `https://cse.google.com/cse/element/v1?rsz=filtered_cse&num=10&hl=en&source=gcsc&gss=.com&start=${from_}&cselibv=b54a745638da8bbb&cx=004266484119952034592:m73hwsklbjg&q=health&safe=off&cse_tok=AJvRUv05x5ATjxZxyw2mYgnC6tOL:1630825621204&sort=&exp=csqr,cc&callback=google.search.cse.api3487`;
    
        let response = await fetch(URL, {
            "referrer": "https://beforeitsnews.com/",
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": null,
            "method": "GET",
            "mode": "cors"
        });
    
        let data = await response.text();
        // console.log(data);
        let splitData = data.split(/\r?\n/);
        let newData = [];
        let length = splitData.length;
    
        for (let idx = 2; idx < length - 1; ++idx) {
            newData.push(splitData[idx]);
        }
        let obj = JSON.parse("{" + newData.join(" ") + "}");
    
        let dataFetch = extractResults(obj.results);
        titles = titles.concat(dataFetch.titles);
        dates = dates.concat(dataFetch.dates);
        links = links.concat(dataFetch.links);

        let rows = dataFetch.links.length;
        for (let i = 0; i < rows; ++i) {
            console.log(`Extracting data for article ${i+1}`);
            let text = await textExtract(dataFetch.links[i]);
            if (text.length != 0) 
                addToCSV(dataFetch.titles[i], text);
        }
    }
}

fetchData().then(() => {});