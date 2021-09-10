import fetch from 'node-fetch';
import puppeteer from "puppeteer";
import fs from "fs";
import csvWriter from "csv-write-stream";
import { text } from 'stream/consumers';

// nbc news
let titles = [];
let links = [];

function addToCSV(titles, texts, dates) {
    let filePath = "../real/real_nbc_content.csv";
    let log = csvWriter({sendHeaders: false});
    if (!fs.existsSync(filePath))
        log = csvWriter({ headers: ["Title", "Len", "Content", "Publishing Date"]});

    log.pipe(fs.createWriteStream(filePath, { flags: 'a' }));

    log.write({
        "Title": titles,
        "Len": texts.length,
        "Content": texts,
        "Publishing Date": dates
    });

    log.end();
}

function addToCSVNoTexts(titles, links) {
    let filePath = "../real/real_nbc_title.csv";
    let log = csvWriter({sendHeaders: false});
    if (!fs.existsSync(filePath))
        log = csvWriter({ headers: ["Title", "Source"]});

    log.pipe(fs.createWriteStream(filePath, { flags: 'a' }));

    let length = titles.length;

    for (let row = 0; row < length; ++row) {
        log.write({
            "Title": titles[row],
            "Source": links[row]
        });
    }

    log.end();
}

// extract titles
// extract link to title
// extract data of title
// extract text of document/news

function grabText() {
    let lst_ = [];
    document.querySelectorAll(".article-body__content > p").forEach((el) => {
        text = el.innerText; 
        if (text.length != 0) { 
            lst_.push(text)
        }
    });
    
    let content =  lst_.join(" ");
    let date = document.querySelector(".article-body__section time").innerText.split(",")[0] + "," + 
    document.querySelector(".article-body__section time").innerText.split(",")[1];
    return { content, date };
}

async function textExtract(URL) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
        
    try {
        await page.goto(URL, {waitUntil: 'load', timeout: 4 * 60 * 1000});
        let text = await page.evaluate(grabText);

        await browser.close();
        return text;
    } catch(e) { return "" }


}

function detailsExtract(results) {
    let titles = [];
    let links = [];

    for (let idx = 0; idx < results.length; ++idx) {
        let result = results[idx];
        if (result.richSnippet.metatags.twitterTitle !== undefined) {
            let title = result.richSnippet.metatags.twitterTitle;
            let link = result.url;

            titles.push(title);
            links.push(link);
        }
    }

    addToCSVNoTexts(titles, links);

    return { titles, links };
}

async function fetchData() {
    let size = 10;
    for (let idx = 3; idx <= 10; ++idx) {
        console.log(`Extracting articles from page ${idx}`);
        let from_ = (idx-1) * size;
        
        let URL = `https://cse.google.com/cse/element/v1?rsz=filtered_cse&num=10&hl=en&source=gcsc&gss=.com&start=${from_}&cselibv=b54a745638da8bbb&cx=003487489644438443209:rbq9uxjpv_m&q=healthcare&safe=off&cse_tok=AJvRUv3IpEkbeBHnMt9UHnaR-LEj:1631189569944&sort=&exp=csqr,cc&callback=google.search.cse.api71`;
    
        let response = await fetch(URL, {
            "referrer": "https://www.nbcnews.com/",
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": null,
            "method": "GET",
            "mode": "cors",
            "credentials": "include"
          });
    
        let data = await response.text();
        //console.log(data);
        let splitData = data.split(/\r?\n/);
        let newData = [];
        let length = splitData.length;
    
        for (let idx = 2; idx < length - 1; ++idx) {
            newData.push(splitData[idx]);
        }
        let obj = JSON.parse("{" + newData.join(" ") + "}");
        // console.log(obj);
        let dataFetch = detailsExtract(obj.results);
        titles = titles.concat(dataFetch.titles);
        links = links.concat(dataFetch.links);

        let rows = dataFetch.links.length;
        for (let i = 0; i < rows; ++i) {
            console.log(`Extracting data for article ${i+1}`);
            let textData = await textExtract(dataFetch.links[i]);
            if (textData.content !== undefined && textData.content.length !== 0 && textData.content !== " ") 
                addToCSV(dataFetch.titles[i], textData.content, textData.date);
        }
    }
}

fetchData().then(() => {});