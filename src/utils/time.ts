
export function formatDate(unixMillis: number): string {
    let date = new Date(unixMillis);
    let formattedDate: string = " " + date.toLocaleTimeString('en-US', { timeStyle: "short" })
    let daysApart: number = calcDaysApart(date, new Date())
    //formattedDate = formattedDate.substring(0, formattedDate.length - 3);
    if (daysApart == 0) {
        formattedDate = "Today at" + formattedDate;
    } else if (daysApart == 1) {
        formattedDate = "Yesterday at" + formattedDate;
    } else if (daysApart <= 7) {
        formattedDate = daysApart + " days ago" + formattedDate;
    } else {
        formattedDate = new Date(unixMillis).toLocaleDateString() + formattedDate;
    }
    return formattedDate;
}

export function calcDaysApart(d1: Date, d2: Date): number {
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    return Math.round((d2.getTime() - d1.getTime())/(1000*60*60*24));
}

export function minutesToMillisecond(min: number): number {
    return min * 60 * 1000;
}

export function formatTime(unixMillis: number): string {
    return new Date(unixMillis).toLocaleTimeString('en-US', { timeStyle: "short" });
}